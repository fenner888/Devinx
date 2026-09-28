# 040 — Local detail timestamps and permission guidance

Phase 13 adds opt-in presentation grants and message timestamps to Local
sessions while preserving legacy Connector and Cloud behavior.

## Compatibility and data

- The phone requests `bridge.features` with
  `{ interaction: true, presentation: true }`. If an older Connector rejects
  presentation, the phone retries with `{ interaction: true }`, then `{}`.
  A rejected presentation capability is remembered per bridge; a successful
  presentation response clears that fallback. The Connector includes
  `messageTimestamps` and strict `grants` only for a presentation request.
- The three grant values describe permission to view sessions, send prompts,
  and start sessions. The phone prefers Connector-reported grants, falls back
  to the paired device's stored permissions, and otherwise treats grants as
  unknown.
- The phone requests `session.load` timestamps only when the Connector
  advertises `messageTimestamps: true` and interaction support is enabled.
  Retrying without interaction drops both opt-in flags. A returned `createdAt`
  is a bounded integer in milliseconds and is included only when a source
  timestamp exists.
- Local timestamps prefer SQLite `metadata.created_at` ISO values and fall
  back to `message_nodes.created_at` Unix seconds converted to milliseconds.
  ACP replay uses `_meta["cognition.ai/timestamp"]` when present. Missing
  timestamps are not synthesized. `AcpHistoryMessage` retains its enumerable
  `{ source, text }` shape; aligned timestamps are carried as a non-enumerable
  property.
- Local detail shows local-day separators and timestamps at the end of each
  consecutive author run. Long-pressing a timestamped message reveals its
  full local date. Untimestamped and live messages remain unchanged; Cloud
  detail is not affected.

## Local Home

Only `connectionMode === "computer"` uses grant-priority ordering:

- When `startSessions` is known to be false, Home shows connection status,
  Recent with up to five rows and View all, a compact Connector-permissions
  guidance card, discovery notices, and the companion. The card remains
  visible with no recent sessions. Composer controls and their heading are
  omitted.
- When session creation is allowed or grants are unknown and recent sessions
  exist, Home shows connection status, up to three Recent rows, a reduced
  companion, and the composer. The reduced companion is sized responsively;
  at 393 pt width it is 141 pt (165 pt including the stage's 24 pt inset).
- With no recent sessions and no known read-only grant, Local Home retains its
  existing composer-first layout. Cloud and Cloud + Local retain their
  existing layout and behavior.

## Validation

New tests cover Connector opt-in and legacy response shapes, timestamp source
fallbacks, phone capability negotiation and timestamp gating, local timestamp
formatting and detail rendering, permission guidance, and Local Home grant
ordering. Cloud Home remains covered as an unchanged-layout regression case.
