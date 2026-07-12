import { chmod, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DevinSessionStore } from '../../bridge/src/devin-session-store';

function createFixture(path: string, schemaVersion = 16): DatabaseSync {
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE refinery_schema_history (version INTEGER PRIMARY KEY);
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      working_directory TEXT NOT NULL,
      main_chain_id INTEGER NOT NULL,
      model TEXT NOT NULL DEFAULT 'adaptive',
      agent_mode TEXT NOT NULL DEFAULT 'agent',
      last_activity_at TEXT NOT NULL DEFAULT '2026-07-11T00:00:00.000Z',
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE message_nodes (
      row_id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      node_id INTEGER NOT NULL,
      parent_node_id INTEGER,
      chat_message TEXT NOT NULL,
      UNIQUE(session_id, node_id)
    );
  `);
  database.prepare('INSERT INTO refinery_schema_history(version) VALUES (?)').run(schemaVersion);
  return database;
}

function insertNode(
  database: DatabaseSync,
  input: {
    sessionId: string;
    nodeId: number;
    parentNodeId?: number;
    role: string;
    content: string;
    privateValue?: string;
  },
): void {
  database
    .prepare(
      `INSERT INTO message_nodes(
        session_id, node_id, parent_node_id, chat_message
      ) VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.nodeId,
      input.parentNodeId ?? null,
      JSON.stringify({
        role: input.role,
        content: input.content,
        thinking: input.privateValue,
        tool_calls: input.privateValue ? [{ private: input.privateValue }] : undefined,
      }),
    );
}

describe('read-only Devin session store', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'devinx-session-store-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads only minimized text from the active main chain during a WAL writer', async () => {
    const databasePath = join(directory, 'sessions.db');
    const writer = createFixture(databasePath);
    const sessionId = 'session-main-chain';
    writer
      .prepare(
        'INSERT INTO sessions(id, working_directory, main_chain_id) VALUES (?, ?, ?)',
      )
      .run(sessionId, '/Users/example/project', 5);
    insertNode(writer, {
      sessionId,
      nodeId: 1,
      role: 'system',
      content: 'private-system-prompt',
    });
    insertNode(writer, {
      sessionId,
      nodeId: 2,
      parentNodeId: 1,
      role: 'user',
      content: 'Build this.',
      privateValue: 'private-user-metadata',
    });
    insertNode(writer, {
      sessionId,
      nodeId: 3,
      parentNodeId: 2,
      role: 'assistant',
      content: 'Working.',
      privateValue: 'private-reasoning',
    });
    insertNode(writer, {
      sessionId,
      nodeId: 4,
      parentNodeId: 3,
      role: 'tool',
      content: 'private-tool-output',
    });
    insertNode(writer, {
      sessionId,
      nodeId: 5,
      parentNodeId: 4,
      role: 'assistant',
      content: 'Done.',
    });
    insertNode(writer, {
      sessionId,
      nodeId: 6,
      parentNodeId: 2,
      role: 'assistant',
      content: 'private-abandoned-branch',
    });
    await chmod(databasePath, 0o600);

    try {
      const store = new DevinSessionStore({ databasePath });
      await store.start();
      const loaded = await store.loadSession(sessionId);
      expect(loaded).toEqual({
        sessionId,
        cwd: '/Users/example/project',
        modelId: 'adaptive',
        messages: [
          { source: 'user', text: 'Build this.' },
          { source: 'devin', text: 'Working.' },
          { source: 'devin', text: 'Done.' },
        ],
        truncated: false,
      });
      expect(JSON.stringify(loaded)).not.toMatch(
        /private-system-prompt|private-user-metadata|private-reasoning|private-tool-output|private-abandoned-branch/,
      );
    } finally {
      writer.close();
    }
  });

  it('fails closed for an unreviewed schema version', async () => {
    const databasePath = join(directory, 'sessions.db');
    const database = createFixture(databasePath, 17);
    database.close();
    await chmod(databasePath, 0o600);

    await expect(new DevinSessionStore({ databasePath }).start()).rejects.toThrow(
      'schema is not supported',
    );
  });

  it('lists only visible, recently observed local workspaces and models', async () => {
    const databasePath = join(directory, 'sessions.db');
    const database = createFixture(databasePath);
    database
      .prepare(
        `INSERT INTO sessions(
          id, working_directory, main_chain_id, model, agent_mode, last_activity_at, hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'session-visible',
        '/Users/example/current-project',
        0,
        'gpt-5-6-sol-medium',
        'agent',
        '2026-07-11T12:00:00.000Z',
        0,
      );
    database
      .prepare(
        `INSERT INTO sessions(
          id, working_directory, main_chain_id, model, agent_mode, last_activity_at, hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'session-hidden',
        '/Users/example/private-project',
        0,
        'private-model',
        'agent',
        '2026-07-11T13:00:00.000Z',
        1,
      );
    database.close();
    await chmod(databasePath, 0o600);

    const store = new DevinSessionStore({ databasePath });
    await store.start();
    await expect(store.listCreateOptions()).resolves.toEqual({
      workspaces: [{ path: '/Users/example/current-project' }],
      models: [{ id: 'gpt-5-6-sol-medium' }],
    });
    await expect(store.getSessionPresentation('session-visible')).resolves.toEqual({
      modelId: 'gpt-5-6-sol-medium',
      agentMode: 'agent',
    });
    await expect(store.getSessionPresentation('session-hidden')).rejects.toThrow(
      'metadata is unavailable',
    );
    await store.stop();
  });

  it('ignores an empty historical model without blocking workspaces or minimized history', async () => {
    const databasePath = join(directory, 'sessions.db');
    const database = createFixture(databasePath);
    database
      .prepare(
        `INSERT INTO sessions(
          id, working_directory, main_chain_id, model, agent_mode, last_activity_at, hidden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'session-empty-model',
        '/Users/example/model-unavailable',
        1,
        '',
        'agent',
        '2026-07-12T12:00:00.000Z',
        0,
      );
    insertNode(database, {
      sessionId: 'session-empty-model',
      nodeId: 1,
      role: 'assistant',
      content: 'History remains available.',
    });
    database.close();
    await chmod(databasePath, 0o600);

    const store = new DevinSessionStore({ databasePath });
    await store.start();
    await expect(store.listCreateOptions()).resolves.toEqual({
      workspaces: [{ path: '/Users/example/model-unavailable' }],
      models: [],
    });
    await expect(store.loadSession('session-empty-model')).resolves.toEqual({
      sessionId: 'session-empty-model',
      cwd: '/Users/example/model-unavailable',
      messages: [{ source: 'devin', text: 'History remains available.' }],
      truncated: false,
    });
    await store.stop();
  });

  it('rejects a symbolic-link database path before opening SQLite', async () => {
    const databasePath = join(directory, 'sessions.db');
    const linkedPath = join(directory, 'linked.db');
    const database = createFixture(databasePath);
    database.close();
    await chmod(databasePath, 0o600);
    await symlink(databasePath, linkedPath);

    await expect(new DevinSessionStore({ databasePath: linkedPath }).start()).rejects.toThrow(
      'path is not trusted',
    );
  });
});
