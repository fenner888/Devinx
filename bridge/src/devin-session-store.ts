import { lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { z } from 'zod';

import type { AcpHistoryMessage, AcpLoadedSession } from './acp';
import { sessionIdSchema } from './schemas';

const REVIEWED_SCHEMA_VERSION = 16;
const MAXIMUM_DATABASE_BYTES = 2 * 1024 * 1024 * 1024;
const MAXIMUM_CHAIN_NODES = 10_000;
const MAXIMUM_MESSAGES = 200;
const MAXIMUM_MESSAGE_BYTES = 100 * 1024;
const MAXIMUM_HISTORY_BYTES = 160 * 1024;
const MAXIMUM_CREATE_OPTIONS = 100;

const modelIdSchema = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:+-]+$/);

const sessionRowSchema = z
  .object({
    workingDirectory: z.string().min(1).max(4_096).refine(isAbsolute),
    mainChainId: z.number().int().nonnegative(),
    modelId: z.union([modelIdSchema, z.literal('')]),
  })
  .strict();

const historyRowSchema = z
  .object({
    depth: z.number().int().min(0).max(MAXIMUM_CHAIN_NODES),
    role: z.enum(['user', 'assistant']),
    content: z.string().max(1024 * 1024),
  })
  .strict();

const chainBoundarySchema = z
  .object({
    depth: z.number().int().min(0).max(MAXIMUM_CHAIN_NODES),
    parentNodeId: z.number().int().nonnegative().nullable(),
  })
  .strict();

const requiredColumns = {
  sessions: new Set([
    'id',
    'working_directory',
    'model',
    'agent_mode',
    'last_activity_at',
    'main_chain_id',
    'hidden',
  ]),
  message_nodes: new Set([
    'session_id',
    'node_id',
    'parent_node_id',
    'chat_message',
  ]),
  refinery_schema_history: new Set(['version']),
} as const;

interface DevinSessionStoreOptions {
  databasePath: string;
  expectedOwnerUid?: number;
}

interface TableColumnRow {
  name: unknown;
}

export interface DevinSessionPresentation {
  modelId: string;
  agentMode: string;
}

export interface DevinCreateOptions {
  workspaces: Array<{ path: string }>;
  models: Array<{
    id: string;
    name?: string;
    description?: string;
    supportsImages?: boolean;
    badge?: 'new' | 'free_promo';
    recent?: boolean;
    recommended?: boolean;
  }>;
  defaultModelId?: string | null;
  catalogSource?: 'live' | 'recent';
}

function utf8Tail(value: string, maximumBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf8');
  try {
    if (bytes.length <= maximumBytes) return { text: value, truncated: false };
    let text = bytes.subarray(bytes.length - maximumBytes).toString('utf8');
    while (text.startsWith('\uFFFD')) text = text.slice(1);
    return { text, truncated: true };
  } finally {
    bytes.fill(0);
  }
}

function messageBytes(message: AcpHistoryMessage): number {
  return Buffer.byteLength(message.text, 'utf8');
}

export class DevinSessionStore {
  private readonly databasePath: string;
  private readonly expectedOwnerUid: number | undefined;
  private supported = false;

  constructor(options: DevinSessionStoreOptions) {
    this.databasePath = z.string().min(1).max(4_096).refine(isAbsolute).parse(options.databasePath);
    this.expectedOwnerUid = options.expectedOwnerUid ?? process.getuid?.();
  }

  isSessionLoadSupported(): boolean {
    return this.supported;
  }

  async start(): Promise<void> {
    await this.validateDatabaseFile();
    const database = this.openDatabase();
    try {
      this.validateSchema(database);
      this.supported = true;
    } finally {
      database.close();
    }
  }

  async stop(): Promise<void> {
    this.supported = false;
  }

  async getSessionPresentation(sessionIdInput: unknown): Promise<DevinSessionPresentation> {
    if (!this.supported) throw new Error('Devin session metadata is unavailable');
    const sessionId = sessionIdSchema.parse(sessionIdInput);
    await this.validateDatabaseFile();
    const database = this.openDatabase();
    try {
      database.exec('PRAGMA query_only = ON; BEGIN;');
      this.validateSchema(database);
      const result = z
        .object({ modelId: modelIdSchema, agentMode: z.string().min(1).max(160) })
        .strict()
        .parse(
          database
            .prepare(
              `SELECT model AS modelId, agent_mode AS agentMode
               FROM sessions WHERE id = ? AND hidden = 0`,
            )
            .get(sessionId),
        );
      database.exec('ROLLBACK;');
      return result;
    } catch {
      try {
        database.exec('ROLLBACK;');
      } catch {
        // The database may have rejected the transaction before it began.
      }
      throw new Error('Devin session metadata is unavailable');
    } finally {
      database.close();
    }
  }

  async listCreateOptions(): Promise<DevinCreateOptions> {
    if (!this.supported) throw new Error('Devin session metadata is unavailable');
    await this.validateDatabaseFile();
    const database = this.openDatabase();
    try {
      database.exec('PRAGMA query_only = ON; BEGIN;');
      this.validateSchema(database);
      const workspaces = database
        .prepare(
          `SELECT working_directory AS path
           FROM sessions
           WHERE hidden = 0
           GROUP BY working_directory
           ORDER BY MAX(last_activity_at) DESC
           LIMIT ?`,
        )
        .all(MAXIMUM_CREATE_OPTIONS)
        .map((row) =>
          z.object({ path: z.string().min(1).max(4_096).refine(isAbsolute) }).strict().parse(row),
        );
      const models = database
        .prepare(
          `SELECT model AS id
           FROM sessions
           WHERE hidden = 0 AND model <> ''
           GROUP BY model
           ORDER BY MAX(last_activity_at) DESC
           LIMIT ?`,
        )
        .all(MAXIMUM_CREATE_OPTIONS)
        .map((row) => z.object({ id: modelIdSchema }).strict().parse(row));
      database.exec('ROLLBACK;');
      return { workspaces, models };
    } catch {
      try {
        database.exec('ROLLBACK;');
      } catch {
        // The database may have rejected the transaction before it began.
      }
      throw new Error('Devin session metadata is unavailable');
    } finally {
      database.close();
    }
  }

  async loadSession(sessionIdInput: unknown): Promise<AcpLoadedSession> {
    if (!this.supported) throw new Error('Devin session history is unavailable');
    const sessionId = sessionIdSchema.parse(sessionIdInput);
    await this.validateDatabaseFile();
    const database = this.openDatabase();
    try {
      database.exec('PRAGMA query_only = ON; BEGIN;');
      this.validateSchema(database);
      const session = sessionRowSchema.parse(
        database
          .prepare(
            `SELECT working_directory AS workingDirectory, main_chain_id AS mainChainId,
                    model AS modelId
             FROM sessions WHERE id = ?`,
          )
          .get(sessionId),
      );
      const chainSql = `
        WITH RECURSIVE chain(depth, node_id, parent_node_id, role, content) AS (
          SELECT
            0,
            node.node_id,
            node.parent_node_id,
            json_extract(node.chat_message, '$.role'),
            json_extract(node.chat_message, '$.content')
          FROM message_nodes AS node
          WHERE node.session_id = ? AND node.node_id = ?
          UNION ALL
          SELECT
            chain.depth + 1,
            parent.node_id,
            parent.parent_node_id,
            json_extract(parent.chat_message, '$.role'),
            json_extract(parent.chat_message, '$.content')
          FROM message_nodes AS parent
          JOIN chain
            ON parent.session_id = ? AND parent.node_id = chain.parent_node_id
          WHERE chain.depth < ?
        )`;
      const rows = database
        .prepare(
          `${chainSql}
           SELECT depth, role, content
           FROM chain
           WHERE role IN ('user', 'assistant') AND typeof(content) = 'text'
           ORDER BY depth ASC
           LIMIT ?`,
        )
        .all(
          sessionId,
          session.mainChainId,
          sessionId,
          MAXIMUM_CHAIN_NODES,
          MAXIMUM_MESSAGES + 1,
        )
        .map((row) => historyRowSchema.parse(row));
      const boundary = chainBoundarySchema.parse(
        database
          .prepare(
            `${chainSql}
             SELECT depth, parent_node_id AS parentNodeId
             FROM chain ORDER BY depth DESC LIMIT 1`,
          )
          .get(sessionId, session.mainChainId, sessionId, MAXIMUM_CHAIN_NODES),
      );
      database.exec('ROLLBACK;');

      let truncated = rows.length > MAXIMUM_MESSAGES || boundary.parentNodeId !== null;
      const chronological = rows.slice(0, MAXIMUM_MESSAGES).reverse();
      const messages = chronological.map((row): AcpHistoryMessage => {
        const clipped = utf8Tail(row.content, MAXIMUM_MESSAGE_BYTES);
        truncated ||= clipped.truncated;
        return { source: row.role === 'user' ? 'user' : 'devin', text: clipped.text };
      });
      let totalBytes = messages.reduce((total, message) => total + messageBytes(message), 0);
      while (messages.length > 0 && totalBytes > MAXIMUM_HISTORY_BYTES) {
        const removed = messages.shift();
        if (!removed) break;
        totalBytes -= messageBytes(removed);
        truncated = true;
      }
      return {
        sessionId,
        cwd: session.workingDirectory,
        messages,
        truncated,
        ...(session.modelId ? { modelId: session.modelId } : {}),
      };
    } catch {
      try {
        database.exec('ROLLBACK;');
      } catch {
        // The database may have rejected the transaction before it began.
      }
      throw new Error('Devin session history is unavailable');
    } finally {
      database.close();
    }
  }

  private openDatabase(): DatabaseSync {
    return new DatabaseSync(this.databasePath, {
      readOnly: true,
      allowExtension: false,
      enableForeignKeyConstraints: false,
      enableDoubleQuotedStringLiterals: false,
      timeout: 1_000,
      defensive: true,
      limits: {
        length: 2 * 1024 * 1024,
        sqlLength: 64 * 1024,
        column: 64,
        exprDepth: 64,
        compoundSelect: 8,
        vdbeOp: 250_000,
        functionArg: 16,
        attach: 0,
        likePatternLength: 1_024,
        variableNumber: 16,
        triggerDepth: 0,
      },
    });
  }

  private async validateDatabaseFile(): Promise<void> {
    const file = await lstat(this.databasePath);
    if (!file.isFile() || file.isSymbolicLink()) {
      throw new Error('Devin session database path is not trusted');
    }
    if (this.expectedOwnerUid !== undefined && file.uid !== this.expectedOwnerUid) {
      throw new Error('Devin session database owner is not trusted');
    }
    // Node exposes POSIX permissions as a bit mask; reject group/other write access.
    // eslint-disable-next-line no-bitwise
    if ((file.mode & 0o022) !== 0 || file.size < 1 || file.size > MAXIMUM_DATABASE_BYTES) {
      throw new Error('Devin session database permissions or size are not trusted');
    }
  }

  private validateSchema(database: DatabaseSync): void {
    const version = database
      .prepare('SELECT MAX(version) AS version FROM refinery_schema_history')
      .get() as { version?: unknown } | undefined;
    if (version?.version !== REVIEWED_SCHEMA_VERSION) {
      throw new Error('Devin session database schema is not supported');
    }
    for (const [table, expected] of Object.entries(requiredColumns)) {
      const actual = new Set(
        database
          .prepare(`PRAGMA table_info('${table}')`)
          .all()
          .map((row) => z.string().parse((row as unknown as TableColumnRow).name)),
      );
      for (const column of expected) {
        if (!actual.has(column)) {
          throw new Error('Devin session database schema is not supported');
        }
      }
    }
  }
}
