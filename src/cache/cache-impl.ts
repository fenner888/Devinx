/**
 * SQLite cache — native implementation (spec §9, ADR-005).
 * This file is only loaded on native platforms (.native.ts extension).
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'devinx_cache.db';
const SCHEMA_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

export async function openCache(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      session_id TEXT NOT NULL,
      cursor TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (session_id, cursor)
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    'schema_version',
    String(SCHEMA_VERSION),
  );
  return db;
}

export async function purgeCache(): Promise<void> {
  const database = await openCache();
  await database.execAsync(`
    DELETE FROM sessions;
    DELETE FROM messages;
    DELETE FROM meta;
  `);
}

export async function cacheIsEmpty(): Promise<boolean> {
  const database = await openCache();
  const row = await database.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) as c FROM sessions',
  );
  return (row?.c ?? 0) === 0;
}

/** Persist the sessions board for offline / cold-start hydration (no secrets). */
export async function saveSessions(sessions: { session_id: string; status: string; updated_at: number }[]): Promise<void> {
  try {
    const database = await openCache();
    const now = new Date().toISOString();
    await database.withTransactionAsync(async () => {
      await database.execAsync('DELETE FROM sessions');
      for (const s of sessions) {
        await database.runAsync(
          'INSERT OR REPLACE INTO sessions (id, payload, status, updated_at, fetched_at) VALUES (?, ?, ?, ?, ?)',
          s.session_id,
          JSON.stringify(s),
          s.status,
          String(s.updated_at),
          now,
        );
      }
    });
  } catch {
    // Cache writes are best-effort; never break the UI over them.
  }
}

/** Read the last-persisted sessions board (offline fallback). */
export async function loadCachedSessions<T>(): Promise<T[]> {
  try {
    const database = await openCache();
    const rows = await database.getAllAsync<{ payload: string }>(
      'SELECT payload FROM sessions ORDER BY CAST(updated_at AS INTEGER) DESC',
    );
    return rows.map((r) => JSON.parse(r.payload) as T);
  } catch {
    return [];
  }
}
