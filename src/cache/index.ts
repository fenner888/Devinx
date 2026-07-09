/**
 * SQLite cache layer — spec §9, ADR-005.
 * Read-only mirror of sessions + messages; purge-on-logout; no secrets.
 *
 * Phase 0 ships the schema + open/purge helpers. Session 1 wires the
 * read-through cache into the query hooks.
 *
 * On web, expo-sqlite uses WASM which needs special metro config. We use a
 * platform-specific extension (.native.ts) so the web bundle doesn't pull
 * in the WASM dependency. The web version is a no-op stub.
 */

// Re-export from the platform-specific implementation.
// On native: ./index.native.ts (real SQLite)
// On web: ./index.web.ts (no-op stub)
export { openCache, purgeCache, cacheIsEmpty, saveSessions, loadCachedSessions } from './cache-impl';
