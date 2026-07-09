/**
 * SQLite cache — web stub (spec §9).
 * expo-sqlite uses WASM on web which needs special metro config. For the web
 * dev preview, the cache is a no-op. The real native implementation lives in
 * cache-impl.native.ts.
 */

export async function openCache(): Promise<unknown> {
  return null;
}

export async function purgeCache(): Promise<void> {
  // No-op on web — the native implementation handles real purge.
}

export async function cacheIsEmpty(): Promise<boolean> {
  return true;
}

export async function saveSessions(): Promise<void> {
  // No-op on web.
}

export async function loadCachedSessions<T>(): Promise<T[]> {
  return [];
}
