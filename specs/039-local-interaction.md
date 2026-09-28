# Spec 039 — Local interaction prompts and command permissions

Phase 12 enables the phone to answer eligible Devin questions and make
least-privilege command-permission decisions in **Local** sessions. Cloud
behavior and the public Cloud API remain unchanged.

## Request and compatibility contract

New interaction fields are strictly opt-in on each request:

- `bridge.features`, `session.list`, `session.load`, and `session.activity`
  accept the optional strict-body field `interaction: true`.
- Only an opted-in `bridge.features` response includes `permissionPrompts`.
  It is true only when the session adapter supports reading a pending
  permission, responding to it, and reading session activity.
- Opted-in session responses may include `activity.awaiting`,
  `activity.terminalQuestion`, and activity statuses `awaiting_input` and
  `timed_out`. Without the opt-in, those fields are omitted and statuses map
  through `legacyActivityStatus`: `awaiting_input` becomes `running`, and
  `timed_out` becomes `failed`. Other legacy response fields retain their
  existing shape.
- The phone requests `bridge.features` with `{interaction:true}`. If an old
  Connector rejects the unknown body key with `invalid_response`, it retries
  once with `{}` and treats `permissionPrompts` as false. It sends the
  interaction flag on session requests only after a successful feature
  negotiation reports `permissionPrompts: true`.
- Feature negotiation is cached in memory by bridge ID for 60 seconds. An
  error drops that bridge's cache entry. The phone's feature schema strips
  unknown flags so a newer Connector can add capabilities without breaking
  older phones.

No permission request or new response field is sent to an older Connector
unless it has advertised the capability. This boundary preserves older
strict-phone and strict-Connector compatibility.

## ACP command permissions

The Connector handles native ACP `session/request_permission` requests for
the active Local prompt. ACP request IDs and raw option IDs remain private to
the ACP client. The phone receives only a random public permission handle and
the safe decisions the Connector could semantically map.

### Safe decision mapping

The Connector maps each decision independently and never relies on option
position:

| Phone decision | ACP option eligible for mapping | Additional rule |
| --- | --- | --- |
| `allow_once` | `kind: "allow_once"` | Exactly one matching option |
| `allow_session` | `kind: "allow_always"` | Exactly one such option, and either `optionId === "allow_session"` or its name matches `\bthis session\b` |
| `reject_once` | `kind: "reject_once"` | Exactly one matching option |

If a decision is missing or ambiguous, it is not offered to the phone.
Project-wide and global persistent grants and bypass-mode switches are never
mapped: they exceed the requested per-command or per-session authority and
cannot be safely represented by the phone's least-privilege controls. The
phone presents only mapped options: **Deny**, **Allow for this session**, and
**Allow** (once). The selected phone decision is translated back to the
private ACP option ID.

An empty decision map, a permission for a session other than the active prompt,
or a second pending permission for the same session is answered `cancelled`
immediately. Otherwise, one bounded pending record is retained per session.
The public payload includes a cryptographically random
`permission_<base64url>` identifier, a whitespace-collapsed title, optional
bounded command text, workspace-relative paths, ordered available decisions,
and creation/expiry times. It never includes the ACP RPC ID or option IDs.

### Bridge authorization

- `session.permission` accepts strict `{sessionId}` and requires
  `session:content:read`.
- `session.permission.respond` accepts strict
  `{sessionId, permissionId, decision}`; the public ID matches
  `^permission_[A-Za-z0-9_-]{43}$`, and decision is one of
  `allow_once | allow_session | reject_once`. It requires
  `session:prompt:send`.
- Unknown, malformed, mismatched-session, expired, or already-resolved
  handles are not distinguishable to the caller: response is the generic 404.
- Permission contents are bounded and copied before crossing the bridge.
  Command control characters are stripped; paths are already workspace
  relative. Permission data and response bodies are validated by strict
  schemas.

### Timeout and activity

The default permission timeout is ten minutes (configurable from one second
through 60 minutes). At timeout, the Connector sends ACP `cancelled`, clears
the pending handle and timer, and marks the associated activity entry
`timed_out` with an end timestamp. A later tool update cannot replace that
terminal status. The opted-in phone UI uses the **Timed out** status; without
opt-in it receives the legacy `failed` mapping. Allowing a pending command
resumes the activity as `running`; a phone decision is never an implicit
approval.
This timeout mark is retained only in Connector memory, so after a Connector
restart an older timed-out step appears as **Failed** because `sessions.db`
persists only the "rejected" result.

## Devin questions

Devin CLI 3000.11.3 emits native ACP `elicitation/create` for
`ask_user_question`. The phone shows the existing structured question form in
a dock above the composer, not in transcript history. Single-select string
fields may allow free text when request metadata contains
`cognition.ai/allowOther: true`; the answer is trimmed and bounded by the
field's maximum (default 2,000 characters). Typing clears the selected chip,
and choosing a chip clears free text. After a successful answer or decline, a
collapsed local-only row says “You answered · <summary>” or “You skipped this
question”. Approval outcomes say “You allowed this command once”, “You allowed
this command for this session”, or “You denied this command”. It clears when a
new interaction appears or a message is sent.

While either a question or command approval is pending, the session header and
Local session list both say “Waiting for your answer” and use the brand status
dot.

## Terminal sessions are read-only for interactions

A pending Terminal question is exposed only when the SQLite session lock is
live and the unresolved tip node is an assistant `ask_user_question` call
whose arguments safely parse as bounded questions. The phone displays those
questions and disabled option chips with a hint to answer in Terminal on the
Mac; it disables the composer while that question is shown. It does not send
an answer to Terminal.

Terminal command approvals are not exposed. The SQLite store does not persist
a `tool_call_state` row or the permission options needed to identify and
authorize an approval. Consequently DevinX cannot detect or approve a pending
Terminal permission from the phone. This limitation does not change the
existing idle Terminal-locked continuation behavior.

## Cloud boundary

Cloud sessions are unchanged. The public Devin v3 messages API flattens
questions into ordinary text; its public contract does not expose structured
question events or answer submissions. Internally, Cloud may represent a
question as a `devin_message` with `content_type: "user_question"` and
`questions: [{question, options[]}]`, and resolution as
`user_question_answered{questions, skip_reason, original_event_id}`. None of
those internal structures are public API data. DevinX must not call private
Cloud endpoints or synthesize structured Cloud question cards.

## Validation

- Test semantic ACP option mapping, shuffled order, ambiguous/missing options,
  rejection, cancellation, duplicate/cross-session requests, and timeout
  behavior including sticky `timed_out`.
- Test permission grants, generic 404 behavior, opt-in response shapes, and
  legacy status mapping.
- Test live-lock Terminal question detection and malformed-question omission.
- Test feature-cache fallback and interaction request gating against an older
  Connector.
- Test permission, elicitation, Terminal question, dock placement, status
  labels, and composer behavior in phone components.
