import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DevinSessionStore } from '../../bridge/src/devin-session-store';

const SESSION_ID = 'session-terminal-question';
const LOCK_PID = 42_424;
const QUESTION_ARGUMENTS = {
  questions: [
    {
      question: 'Which files should I list?',
      header: 'Scope',
      options: [
        { label: 'Configuration files', description: 'Project configuration' },
        { label: 'Source files', description: 'Application source' },
      ],
      multiSelect: false,
    },
  ],
};

describe('Terminal question history', () => {
  let directory: string;
  let store: DevinSessionStore | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'devinx-terminal-question-'));
  });

  afterEach(async () => {
    await store?.stop();
    await rm(directory, { recursive: true, force: true });
  });

  async function createStore(argumentsValue: unknown): Promise<DevinSessionStore> {
    const databasePath = join(directory, 'sessions.db');
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE refinery_schema_history (version INTEGER PRIMARY KEY);
      INSERT INTO refinery_schema_history(version) VALUES (17);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        working_directory TEXT NOT NULL,
        main_chain_id INTEGER NOT NULL,
        model TEXT NOT NULL DEFAULT 'adaptive',
        agent_mode TEXT NOT NULL DEFAULT 'agent',
        last_activity_at TEXT NOT NULL,
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
    database
      .prepare(
        'INSERT INTO sessions(id, working_directory, main_chain_id, last_activity_at) VALUES (?, ?, ?, ?)',
      )
      .run(SESSION_ID, '/Users/example/workspace', 2, new Date().toISOString());
    database
      .prepare(
        'INSERT INTO message_nodes(session_id, node_id, parent_node_id, chat_message) VALUES (?, ?, ?, ?)',
      )
      .run(
        SESSION_ID,
        1,
        null,
        JSON.stringify({ role: 'user', content: 'Answer the question in Terminal.' }),
      );
    database
      .prepare(
        'INSERT INTO message_nodes(session_id, node_id, parent_node_id, chat_message) VALUES (?, ?, ?, ?)',
      )
      .run(
        SESSION_ID,
        2,
        1,
        JSON.stringify({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'tool-question',
              name: 'ask_user_question',
              arguments: argumentsValue,
            },
          ],
        }),
      );
    database.close();
    await chmod(databasePath, 0o600);

    const lockDirectory = join(directory, 'session_locks');
    await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
    await writeFile(join(lockDirectory, `${SESSION_ID}.lock`), String(LOCK_PID), {
      mode: 0o600,
    });
    const sessionStore = new DevinSessionStore({
      databasePath,
      lockDirectory,
      isProcessAlive: (pid) => pid === LOCK_PID,
    });
    await sessionStore.start();
    store = sessionStore;
    return sessionStore;
  }

  it('exposes a bounded pending question and marks the stored tool awaiting input', async () => {
    const sessionStore = await createStore(QUESTION_ARGUMENTS);

    const liveness = await sessionStore.getSessionLiveness(SESSION_ID);
    expect(liveness).toMatchObject({
      active: true,
      pendingQuestion: {
        questions: [
          {
            question: 'Which files should I list?',
            header: 'Scope',
            options: ['Configuration files', 'Source files'],
            multiSelect: false,
          },
        ],
      },
    });

    const loaded = await sessionStore.loadSession(SESSION_ID);
    expect(loaded.activity).toEqual([
      expect.objectContaining({
        kind: 'tool',
        status: 'awaiting_input',
        title: 'ask_user_question',
      }),
    ]);
    expect(JSON.stringify(liveness?.pendingQuestion)).not.toContain('/Users/example/workspace');
  });

  it('omits malformed questions instead of returning unbounded Terminal data', async () => {
    const sessionStore = await createStore({
      questions: [
        {
          question: 'q'.repeat(501),
          options: [{ label: 'Option' }],
          multiSelect: false,
        },
      ],
    });

    const liveness = await sessionStore.getSessionLiveness(SESSION_ID);
    expect(liveness).toMatchObject({
      active: true,
    });
    expect(liveness).not.toHaveProperty('pendingQuestion');
  });
});
