# 040 — Local detail timestamps and permission guidance

Phase 13 adds opt-in presentation grants and message timestamps to Local
sessions while preserving legacy Connector and Cloud behavior.

## Compatibility and data

- The phone keeps the legacy interaction feature negotiation unchanged and
  requests presentation separately with `{ presentation: true }`. A rejected
  presentation capability is remembered per bridge. The Connector includes
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

- Only Connector-reported `startSessions: false` makes Home read-only. In that
  case Home shows connection status,
  Recent with up to five rows and View all, a compact Connector-permissions
  guidance card, discovery notices, and the companion. The card remains
  visible with no recent sessions. Composer controls and their heading are
  omitted.
- Pairing-stored permissions are only a fallback for permission guidance and
  do not change Home's composer-first layout, because those grants may be stale.
- When Connector-reported session creation is allowed or grants are unknown
  and recent sessions exist, Home shows connection status, up to three Recent
  rows, a reduced companion, and the composer. The reduced companion is sized
  responsively; at 393 pt width it is 141 pt (165 pt including the stage's
  24 pt inset). With no recent sessions and no Connector-reported read-only
  grant, Local Home retains its existing composer-first layout. Cloud and
  Cloud + Local retain their existing layout and behavior.

## Validation

New tests cover Connector opt-in and legacy response shapes, timestamp source
fallbacks, phone capability negotiation and timestamp gating, local timestamp
formatting and detail rendering, permission guidance, and Local Home grant
ordering. Cloud Home remains covered as an unchanged-layout regression case.
