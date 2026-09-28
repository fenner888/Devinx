import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DevinSessionStore } from '../../bridge/src/devin-session-store';

function createFixture(path: string, hasCreatedAt: boolean): DatabaseSync {
  const database = new DatabaseSync(path);
  database.exec(`
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
      chat_message TEXT NOT NULL${hasCreatedAt ? ',\n      created_at REAL' : ''}
    );
  `);
  database.prepare('INSERT INTO refinery_schema_history(version) VALUES (16)').run();
  return database;
}

function insertNode(
  database: DatabaseSync,
  hasCreatedAt: boolean,
  input: {
    sessionId: string;
    nodeId: number;
    parentNodeId?: number;
    role: string;
    content: string;
    createdAt?: number;
    metadata?: Record<string, unknown>;
  },
): void {
  const chatMessage = JSON.stringify({
    role: input.role,
    content: input.content,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  if (hasCreatedAt) {
    database
      .prepare(
        `INSERT INTO message_nodes(session_id, node_id, parent_node_id, chat_message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.sessionId, input.nodeId, input.parentNodeId ?? null, chatMessage, input.createdAt ?? null);
  } else {
    database
      .prepare(
        `INSERT INTO message_nodes(session_id, node_id, parent_node_id, chat_message)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.sessionId, input.nodeId, input.parentNodeId ?? null, chatMessage);
  }
}

describe('Devin session store message timestamps', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'devinx-session-message-times-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('prefers ISO metadata and converts optional SQLite seconds to milliseconds', async () => {
    const databasePath = join(directory, 'sessions.db');
    const database = createFixture(databasePath, true);
    const sessionId = 'session-message-times';
    database
      .prepare('INSERT INTO sessions(id, working_directory, main_chain_id) VALUES (?, ?, ?)')
      .run(sessionId, '/Users/example/project', 3);
    insertNode(database, true, {
      sessionId,
      nodeId: 1,
      role: 'user',
      content: 'Metadata timestamp wins.',
      createdAt: 1_700_000_000,
      metadata: { created_at: '2026-09-28T15:41:00.123Z' },
    });
    insertNode(database, true, {
      sessionId,
      nodeId: 2,
      parentNodeId: 1,
      role: 'assistant',
      content: 'SQLite timestamp is seconds.',
      createdAt: 1_700_000_001,
    });
    insertNode(database, true, {
      sessionId,
      nodeId: 3,
      parentNodeId: 2,
      role: 'user',
      content: 'Negative timestamps are rejected.',
      createdAt: -1,
      metadata: { created_at: '0000-01-01T00:00:00.000Z' },
    });
    database.close();
    await chmod(databasePath, 0o600);

    const store = new DevinSessionStore({ databasePath });
    await store.start();
    try {
      const loaded = await store.loadSession(sessionId);

      expect(loaded.messages).toEqual([
        { source: 'user', text: 'Metadata timestamp wins.' },
        { source: 'devin', text: 'SQLite timestamp is seconds.' },
        { source: 'user', text: 'Negative timestamps are rejected.' },
      ]);
      expect(loaded.messageTimes).toEqual([
        Date.parse('2026-09-28T15:41:00.123Z'),
        1_700_000_001_000,
        undefined,
      ]);
      expect(Object.prototype.propertyIsEnumerable.call(loaded, 'messageTimes')).toBe(false);
    } finally {
      await store.stop();
    }
  });

  it('loads history without the optional created_at column', async () => {
    const databasePath = join(directory, 'sessions.db');
    const database = createFixture(databasePath, false);
    const sessionId = 'session-no-created-at';
    database
      .prepare('INSERT INTO sessions(id, working_directory, main_chain_id) VALUES (?, ?, ?)')
      .run(sessionId, '/Users/example/project', 1);
    insertNode(database, false, {
      sessionId,
      nodeId: 1,
      role: 'user',
      content: 'History remains available.',
    });
    database.close();
    await chmod(databasePath, 0o600);

    const store = new DevinSessionStore({ databasePath });
    await store.start();
    try {
      const loaded = await store.loadSession(sessionId);
      expect(loaded.messageTimes).toEqual([undefined]);
      expect(loaded.messages).toEqual([{ source: 'user', text: 'History remains available.' }]);
    } finally {
      await store.stop();
    }
  });
});
