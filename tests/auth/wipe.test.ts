/**
 * §10.5 gate test — disconnect wipes Keychain + SQLite cache + query cache.
 * Uses mocked secure-store + mocked sqlite.
 */

import { wipeAllSecrets, hasCredentials } from '../../src/auth/keychain';
import { purgeCache, cacheIsEmpty } from '../../src/cache';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn((key: string, value: string) => { store.set(key, value); return Promise.resolve(); }),
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    deleteItemAsync: jest.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 2,
    _store: store,
  };
});

// Mock expo-sqlite
jest.mock('expo-sqlite', () => {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    sessions: [{ id: 'devin-test', payload: '{}', status: 'running', updated_at: '1', fetched_at: '1' }],
    messages: [],
    meta: [{ key: 'schema_version', value: '1' }],
  };
  return {
    openDatabaseAsync: jest.fn(() => Promise.resolve({
      execAsync: jest.fn(async (sql: string) => {
        if (sql.includes('DELETE FROM sessions')) tables.sessions = [];
        if (sql.includes('DELETE FROM messages')) tables.messages = [];
        if (sql.includes('DELETE FROM meta')) tables.meta = [];
      }),
      runAsync: jest.fn(async () => ({ rowsAffected: 1 })),
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('sessions')) return { c: tables.sessions?.length ?? 0 };
        return null;
      }),
    })),
  };
});

// Import the mocked module at the top level
import * as SecureStore from 'expo-secure-store';

describe('disconnect wipe (§10.5 gate)', () => {
  it('wipes all keychain secrets', async () => {
    // Prime the store with credentials.
    await SecureStore.setItemAsync('devin_api_key', 'cog_test123456789012');
    await SecureStore.setItemAsync('devin_org_id', 'org-test123456789012');
    await SecureStore.setItemAsync('auth_kind', 'service_user');
    expect(await hasCredentials()).toBe(true);

    await wipeAllSecrets();

    expect(await hasCredentials()).toBe(false);
    expect(await SecureStore.getItemAsync('devin_api_key')).toBeNull();
    expect(await SecureStore.getItemAsync('devin_org_id')).toBeNull();
    expect(await SecureStore.getItemAsync('auth_kind')).toBeNull();
    expect(await SecureStore.getItemAsync('attribution_user_id')).toBeNull();
  });

  it('purges the SQLite cache', async () => {
    const empty = await cacheIsEmpty();
    expect(empty).toBe(false); // has the primed session row

    await purgeCache();

    const stillEmpty = await cacheIsEmpty();
    expect(stillEmpty).toBe(true);
  });

  it('wipeAllSecrets is idempotent (safe to call when already empty)', async () => {
    await expect(wipeAllSecrets()).resolves.not.toThrow();
    await expect(wipeAllSecrets()).resolves.not.toThrow();
  });
});
