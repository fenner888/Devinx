# Spec 038 — Local activity timeline

Phase 11. DevinX surfaces a bounded, privacy-conscious timeline of Devin's
thoughts and tool activity for **local sessions only** — sessions read from
the Mac's own `sessions.db` or live via the Devin ACP protocol through the
DevinX Connector. Cloud sessions are unchanged.

## Purpose & scope

- Local (Computer-origin) sessions only. Cloud sessions never carry activity
  entries and render exactly as before.
- The timeline answers "what is Devin doing / what did it do" between chat
  messages: thinking, file reads/edits, commands, searches, fetches.
- It is read-only. No activity payload ever steers a session, and no raw
  session identifier, absolute path, or private home directory crosses the
  bridge.

## Privacy boundary

- The **chat timeline** may show thought text, tool titles, workspace-relative
  paths, diffs, and bounded command output — the same class of content the
  session transcript already exposes under the `session:content:read` grant.
- The **companion pet stays text-free** (see `devin-companion.md`): the
  activity signal drives only the pet's animation state and the short
  transport label; it never carries task labels, thoughts, tool
  inputs/outputs, or paths into the companion surface.
- Paths are always workspace-relative (or basename) — never absolute, never
  `~`-rooted, never containing `..`.
- Nothing in the activity pipeline is logged.

## Data model

`ActivityEntry` (bridge `activityEntrySchema` ↔ phone
`computerActivityEntrySchema`, identical bounds):

| Field | Rule |
| --- | --- |
| `id` | 1–128 chars. `tool_<sha256(toolCallId)[:32]>` for tools; `thought_<n>` for thoughts |
| `afterSequence` | int ≥ 0; index of the preceding chat message (0 = before the first). Must be ≤ `messages.length` after trimming |
| `kind` | `'thought' \| 'tool'` |
| `toolKind` | optional: `read / edit / delete / move / search / execute / think / fetch / other` |
| `status` | `running / completed / failed / interrupted / unknown / awaiting_input / timed_out` |
| `title` | 1–200 chars, whitespace-collapsed, no control chars |
| `paths` | ≤ 20 entries, each ≤ 512 chars, workspace-relative only |
| `detail` | `{type:'text'}` ≤ 16 KiB, or `{type:'diff', path, oldText?, newText?}` each ≤ 16 KiB |
| `truncated` | set whenever content was clipped or dropped |
| `startedAt`/`endedAt` | optional epoch ms |

Aggregate bounds: **500 entries** per timeline (oldest dropped first),
**160 KiB total detail bytes** (oldest details stripped first, entry marked
`truncated`), per-detail cap 16 KiB (UTF-8 tail clip, never splitting a
multi-byte character). `ActivityLog` fails closed: any invalid update is
skipped and flags `truncated` instead of throwing.

## Transport fitting

The phone rejects bridge responses over 256 KiB, so `session.load` and
`session.activity` responses are capped at **192 KiB serialized**. Fitting
order inside `fitLoadedSessionResponse` / `fitActivityResponse`:

1. strip `detail` from the oldest entry that still has one (`truncated:true`);
2. drop the oldest entry entirely (`truncated:true`);
3. fall through to the existing oldest-message trimming (unchanged).

**Deviation (accepted):** the original design budgeted 512 KiB of activity
detail, but that alone exceeds the 256 KiB transport limit and would make the
fitter throw after dropping every message. The ActivityLog pre-bounds to
160 KiB so a normal timeline always survives fitting.

## ACP mapping

Observed update shapes (discovery notes, `session/update` notifications):

- `agent_thought_chunk` (text) → merges into one open thought entry per run;
  closes `completed` when a tool starts or the turn ends.
- `tool_call` → begins a tool entry. `kind` accepted verbatim when it is a
  known `ActivityToolKind`; otherwise derived from
  `_meta['cognition.ai/inferenceToolName']`. Status `pending`/`in_progress` →
  `running`, `completed` → `completed`, `failed` → `failed`, anything else →
  `unknown`.
- Detail is **diff-first**: the first `content` item of `type:'diff'` becomes
  the entry detail (path relativized). Text content items concatenate into a
  text detail. A `resource` item with `mimeType:'text/x-shellscript'` becomes
  the execute preview: text detail prefixed `$ <command>\n` so output appends
  after it.
- `tool_call_update` appends text output to a text detail (a diff detail is
  kept) and applies status changes; `_meta.terminal_exit.exit_code` appends
  `\nExit code: N`; completed/failed sets `endedAt`.
- Replay-only `_meta['cognition.ai/timestamp']` (ISO string or ms) supplies
  `startedAt`/`endedAt`. Live updates carry no timestamp.
- Replay does **not** include command output — output text only appears live.
- Any entry still `running` at `end_turn` becomes `interrupted`.
- A tool blocked on a supported phone question or approval becomes
  `awaiting_input`; it returns to `running` when answered. A permission that
  reaches its timeout becomes `timed_out`, and later updates cannot overwrite
  that terminal status.

Replay `afterSequence` = `collector.messages.length` at arrival; the service
remaps it through message filtering/renumbering/dropping so it always indexes
into the returned `messages` array (clamped to `messages.length`).

## SQLite mapping

Same read-only transaction as the minimized history load (schema v16/17):

- The recursive main-chain walk additionally pulls the full `chat_message`
  JSON; assistant nodes are deduplicated by `message_id` (the CLI persists
  each assistant message twice — the second copy carries the
  `chisel/tool_call_content` extension).
- Assistant `thinking.thinking` → thought entry; each `tool_calls[i]` →
  `beginTool` with input from `tool_call_state.tool_call_json` (preferred),
  else `metadata.extensions['chisel/tool_call_content'][id]`, else a
  synthesized `{title, kind, rawInput}` from name + arguments.
- `tool_call_state` is an **optional table** (present in reviewed schemas
  16/17, absent from minimal fixtures); when missing, the extension/synthesized
  fallbacks are used.
- `role:'tool'` nodes resolve calls: `chisel/tool_result_meta.success===false`
  → `failed`, else `completed`; node `content` becomes the output text;
  `chisel/tool_call_timing` `started_at`/`finished_at` ISO → ms.
- Unresolved calls → `running` if the session lock PID is alive (below), else
  `interrupted`.
- Unknown/unparseable node shapes are skipped, `truncated:true` is set, and
  the messages are still returned (fail closed, never guess the schema).
- `afterSequence` counts emitted user/assistant text messages and is
  renumbered when history trimming shifts old messages off.

## Feature negotiation

`bridge.features` returns `activityTimeline: true` when the Connector supports
session load. The phone parses it as **optional**: an older Connector that
omits the field still yields `sessionElicitation` correctly and the phone
renders exactly as before — no groups, no live turn, no indicator. A
malformed features response still fails closed to all-false.

Interaction-specific statuses and fields are separately opt-in per request.
The phone first negotiates `permissionPrompts`; only then does it send
`interaction: true` with `bridge.features`, `session.list`, `session.load`, and
`session.activity`. Without that flag, the Connector omits all new response
fields and maps `awaiting_input` to legacy `running` and `timed_out` to legacy
`failed`. This keeps responses compatible with older phones that strictly
parse the original status set.

## Live turn

`session.activity` gains an optional `turn: {startedAt, reply, activity}`:

- The Connector holds the in-flight (or most recently finished) prompt's
  reply text — UTF-8 tail clipped to **100 KiB** — plus the turn's
  `ActivityLog`; `finishTurn` marks stragglers `interrupted`.
- The snapshot stays readable until the next prompt starts or the client
  stops — but the phone only renders it for **its own in-flight prompt** and
  only when `turn.startedAt >= promptStartedAt` (5 s skew slack), so a stale
  previous turn is never shown as "Generating…".
- When the turn settles, the next `session.load` refetch replaces the live
  group with the persisted timeline.

## TUI active signal (decided)

The Devin TUI writes `session_locks/<sessionId>.lock` next to `sessions.db`
containing a PID. The file is **not removed on clean exit**, so presence
alone means nothing; liveness is `process.kill(pid, 0)` (EPERM counts as
alive, own PID does not). Combined with the newest `message_nodes` row for
the session:

- live lock + `user`/`tool` tip → `active: true, kind: 'thinking'`;
- live lock + assistant tip with unresolved `tool_calls` → `active: true`,
  `kind` mapped from the last unresolved tool name;
- live lock + finished assistant tip, dead/missing/foreign lock → inactive;
- unknown tip shape → active only when `last_activity_at` is within 60 s;
- **30-minute staleness guard**: a live-lock user/tool tip older than
  30 minutes reports inactive (a Ctrl-C'd TUI leaves the lock alive forever).
- `last_activity_at` alone is insufficient because the TUI does not bump it
  while a long command runs or an approval waits.

## Phone UI

- `ActivityGroup` renders entries grouped by `afterSequence`: `g0` before the
  first message, `g<N>` after message `N`. Persisted groups default
  collapsed; the live group (`live-<startedAt>`) defaults expanded and is
  keyed per turn so collapse state never carries over.
- Expansion state is memory-only (`useActivityExpansion` zustand store, keyed
  `bridgeId/sessionId/groupOrEntryId`).
- The group header shows `summarizeActivity` — `Thought` + per-kind counts
  (`Read N file(s)`, `Edited N file(s)`, `Changed N file(s)`,
  `Ran N command(s)`, `Searched`, `Fetched N page(s)`, `N step(s)`) + elapsed
  seconds — plus a status dot (pulsing while running) and a non-completed
  status label using `statusLabels`. Group status priority is
  `awaiting_input > running > failed > timed_out > interrupted > unknown`.
  Awaiting input uses the brand dot; timeout uses the blocked dot.
- Step rows show a per-kind glyph, title, relative-path chips (≤3 + `+N`),
  and expand to detail: diffs render with common prefix/suffix context lines
  and `diffAddedText/diffAddedTint` / `diffRemovedText/diffRemovedTint`
  tokens; text output in a bounded monospace block (400-line/240-pt caps with
  "Show more"); thought text in muted italic; clipped content shows a
  "Trimmed" caption.
- Session list rows and the detail header show a running dot +
  `activityShortLabel(kind)` only while `activity.active`, except that an
  awaiting answer is labeled `Waiting for your answer`. Idle sessions remain
  unchanged.

## Compatibility & fail-closed

| Condition | Behavior |
| --- | --- |
| Connector without `activityTimeline` | Phone renders exactly as before |
| Request without `interaction: true` | New fields omitted; statuses use legacy mapping |
| Connector without `session.activity.turn` | `turn` omitted; list/persisted views unaffected |
| `tool_call_state` table missing | Extension/synthesized tool inputs; load succeeds |
| Unknown `chat_message` shape | Node skipped, `truncated:true`, messages returned |
| Activity exceeds transport cap | Oldest details stripped, then oldest entries dropped |
| `afterSequence` beyond messages | Phone schema rejects the whole load (`invalid_response`) |
| Absolute/`~`/`..` path in entry | Rejected by schema at both boundaries |
| Malformed lock file / dead PID | Session reported inactive |

## Tests

- `tests/bridge/activity-log.test.ts` — status/kind maps, thought merging,
  path relativization, diff preference, `$ cmd` + exit code, 16 KiB UTF-8
  clip, entry/detail budgets, interrupted-on-finish, fail-closed.
- `tests/bridge/acp-activity.test.ts` — replay fixture → timeline with
  timestamps, live turn collection/retention, 100 KiB reply clip,
  `WINDSURF_API_KEY` pass-through.
- `tests/bridge/devin-session-store.test.ts` — TUI fixture mapping, unknown
  shapes, all `getSessionLiveness` branches incl. the staleness guard.
- `tests/bridge/bridge-service.test.ts` — feature flag, afterSequence remap,
  transport fitting, `turn` pass-through, list `activity`, schema rejection.
- `tests/components/ActivityGroup.test.tsx`, `ComputerSessionDetail.test.tsx`,
  `ComputerSessionRow.test.tsx` — summarize strings, expand/collapse
  persistence, diff lines, status labels, live/stale-turn gating, indicator
  and row label, legacy-Connector fallback.
- `tests/auth/computer-bridge.test.ts` — legacy features parse, absolute-path
  and `afterSequence` schema rejection.
