# 024 — Concurrent local history and continuation

Status: implemented and automated-test validated; physical locked-session continuation validation remains

## Product requirement

DevinX must be able to display local Devin history while the same session is open in Devin Desktop or another Devin client. A second ACP process cannot satisfy this requirement because the current Devin CLI grants exclusive live ownership of a loaded session. `session/list` may still enumerate that session, but `session/load` returns an invalid-request response stating that the session is already open elsewhere.

Hermes WebUI solves the analogous problem by reading its agent-owned SQLite transcript store and importing a continuation under one WebUI owner. DevinX adopts the same separation of responsibilities without writing to Devin storage:

- read history from Devin's local session store using a bounded read-only snapshot;
- use ACP for live session operations;
- when ACP cannot acquire the original session, create an explicit Connector-owned continuation rather than killing or competing with the existing owner; and
- preserve the relationship between the original history and its continuation in DevinX.

## Read-only history boundary

The macOS Connector may read `~/.local/share/devin/cli/sessions.db` only when all of the following hold:

- the path is derived from the Connector's validated absolute home directory;
- the path is an owned regular file and not a symbolic link;
- the file is not group- or world-writable and remains below the configured size bound;
- SQLite is opened with Node's built-in `node:sqlite` API in read-only mode with extension loading disabled, defensive resource limits, and a short busy timeout;
- the migration version and required tables/columns match the reviewed compatibility contract; and
- every result is parsed through bounded Zod schemas before it reaches bridge logic.

The query follows only `sessions.main_chain_id` through `message_nodes.parent_node_id`. It selects only `user` and `assistant` roles and only their text `content` for the history messages. The activity timeline (spec 038) is the single reviewed exception to that minimization: the same walk additionally reads the full `chat_message` JSON for the accepted shapes — assistant `thinking.thinking` and `tool_calls` (id, name, arguments), and `role:'tool'` nodes' `tool_call_id`, `content`, and the `chisel/tool_result_meta` / `chisel/tool_call_timing` / `chisel/tool_call_content` extensions — plus the optional `tool_call_state` table (present in reviewed schemas 16/17; absent fixtures fall back to extension or synthesized tool inputs). Assistant nodes persisted twice are deduplicated by `message_id`. Unknown or unparseable node shapes fail closed: they are skipped, `truncated:true` is set, and the minimized messages are still returned. The continuation context remains text-only — activity entries never feed the embedded context and never select or return system messages, images, prompts, shell history, rendered HTML, alternate branches, or fields beyond the accepted shapes.

The historical `sessions.model` field is presentation metadata, not a condition for reading an
otherwise valid transcript. Devin currently persists an empty model marker for some valid sessions.
The Connector treats that exact empty value as “model unavailable,” omits the model label, and still
returns the minimized history. Any other malformed model value continues to fail closed.

History remains bounded to the newest 200 text messages, 100 KiB per message, 160 KiB total, and 10,000 traversed main-chain nodes. Any clipping, incompatible record, missing ancestor, or traversal limit marks the response truncated. A schema mismatch fails closed to ACP or unavailable history; it never guesses at a new private schema.

## Live continuation boundary

An unlocked session continues through the existing authorized `session/prompt` path. A locked session must not cause DevinX to kill Devin Desktop, delete a lock, write to `sessions.db`, inject UI events, or parse private process memory.

The supported fallback is a new Connector-owned ACP session created with `session/new` after capability and synthetic-contract validation. The Connector supplies a minimized, bounded context derived from the authorized read-only history using ACP embedded context, then sends the user's new text. The original session remains untouched. The bridge returns a new opaque handle, and DevinX explicitly navigates to that new Devin-persisted session so subsequent history and steering use the new owner without pretending the original session was mutated.

Until that continuation path passes synthetic and physical validation, locked sessions are readable but steering remains unavailable with an explicit `session_in_use` state.

## Restart and contention recovery

Opaque session handles remain deterministic for a Connector installation, but the in-memory handle-to-session mapping is intentionally rebuilt from authenticated `session.list` results after a Connector restart. The mobile client may therefore receive one authorization-shaped `404` when it opens a previously listed local session before the restarted Connector has rehydrated that mapping.

For the read-only `session.load` path only, DevinX performs one bounded recovery:

1. authenticate `bridge.health`;
2. enumerate the same local device through the existing bounded `session.list` pagination;
3. require the original opaque handle to appear in that authenticated result; and
4. retry `session.load` exactly once.

If the handle is not rediscovered, any request fails, or the retry fails, DevinX preserves the public failure and does not guess a raw session identifier. Write operations (`session.prompt`, `session.create`, elicitation responses, revocation) never use this automatic retry because replaying a successful-but-unacknowledged write could duplicate user intent.

Connector read contention is distinct from request-rate limiting. A `429` response with the allowlisted `{ "error": "busy" }` body maps to a transient busy state; other `429` responses remain rate-limited. The secure native and Tailnet transports accept the Connector's documented `409` session-conflict response so it can reach the typed client error boundary instead of becoming an opaque transport failure.

## Authorization and privacy

- `session:content:read` remains required server-side for every history request.
- `session:prompt:send` remains separately required for every continuation or prompt.
- The phone sends only opaque handles; raw Devin session IDs and database paths remain Mac-local.
- No transcript content, identifiers, paths, SQLite errors, ACP errors, or prompt bodies are logged.
- A failed write, unknown method, unauthorized handle, cross-device request, or schema mismatch fails closed with an allowlisted public error.

## Validation gates

- Synthetic SQLite fixtures cover ownership/path rejection, schema drift, main-chain traversal, branch exclusion, role filtering, clipping, and concurrent WAL reads.
- Existing ACP/list/load/prompt authorization, rate-limit, replay, and secret-leak tests remain green.
- A restarted Connector rejects the stale in-memory mapping once, rehydrates it from an authenticated bounded list, and loads the same opaque session handle on the single retry.
- A missing handle, offline Connector, or unauthorized device does not loop, enumerate across devices, or retry a write.
- Connector `busy`, rate-limited, and session-conflict responses remain distinct typed states through both secure transports.
- The Connector build contains no new dependency and uses the pinned Node runtime.
- Physical validation opens one session in Devin Desktop, loads its full minimized history on iPhone, creates a continuation, receives a reply, and confirms the Desktop-owned original was not terminated or modified.
