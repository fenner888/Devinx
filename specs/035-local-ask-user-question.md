# Local AskUserQuestion support

Status: Live for Local sessions with Devin CLI 3000.11.3. Cloud sessions are unchanged.

## Problem

ACP defines an agent-to-client `elicitation/create` request for structured user input. DevinX
Connector implements that bounded protocol safely. Devin CLI 3000.11.3 emits `elicitation/create`
for `ask_user_question`; earlier testing against 3000.1.27 did not exercise this native path.

## Supported contract

- Connector advertises ACP form elicitation support only. URL elicitation remains unsupported.
- Connector accepts session-scoped `elicitation/create` requests whose form contains bounded
  primitive fields: string, number, integer, boolean, or a string multi-select.
- The mobile app polls for one pending question for the opened local session and may explicitly
  accept, decline, or cancel it.
- A single-select string field with `_meta["cognition.ai/allowOther"] === true` allows a trimmed
  free-text answer up to the field's declared limit (or 2,000 characters). Typing clears the selected
  chip; selecting a chip clears free text.
- The local question card is docked above the composer, outside the transcript scroll view. After a
  successful accept, the collapsed row says “You answered · <summary>”; a decline says
  “You skipped this question”. The row stays visible until another interaction appears or a prompt
  is sent.
- While a question or command approval is pending, the session header and Local session list both
  say “Waiting for your answer” and use the brand status dot.
- Accepted content is validated again against the original requested schema on the Mac before it
  is returned to Devin. Field names and raw ACP request IDs are never exposed as authority-bearing
  bridge identifiers.
- `session/request_permission` is not an AskUserQuestion request. Its safe permission decisions and
  phone UI are specified in [039-local-interaction.md](039-local-interaction.md); the Connector
  never auto-approves tool execution.
- Unknown agent-to-client methods receive a JSON-RPC method-not-found error and do not crash the
  Connector runtime.

ACP marks elicitation as unstable. The implementation is isolated behind strict schemas and the
exact `Waiting for your answer` activity transition so it can fail closed if the wire contract
changes. The existing bridge health shape remains unchanged; this preserves compatibility between
the updated Connector and iOS builds that predate question support.

Protocol handling is negotiated through an authenticated `bridge.features` request. The phone opts
in to interaction fields and sends interaction requests only after the Connector advertises support.
A legacy Connector that rejects the new request body is retried once without the opt-in; question
and permission support are then treated as unavailable. The detailed compatibility contract is in
[039-local-interaction.md](039-local-interaction.md).

The boolean means that Connector can safely serve an elicitation if one arrives. It is not a claim
that the selected Devin agent or model provides an AskUserQuestion tool. Product copy and release
notes must keep that distinction explicit until Cognition documents and ships the agent behavior.

## Authorization and privacy

- Reading a pending question requires `session:content:read`.
- Answering, declining, or cancelling a question requires `session:prompt:send` and uses the same
  per-device signature, replay protection, session-handle scope, and write rate limit as steering.
- Unauthorized, stale, mismatched-session, and already-resolved interaction handles return the
  generic 404 response.
- Connector forwards only the minimized question text, field labels, constraints, and display
  options. ACP metadata, raw inputs, private extension data, and the original JSON-RPC ID remain on
  the Mac.
- Pending interactions live in memory only and are cleared when answered, cancelled, the prompt
  ends, or the Connector stops.

## Cloud boundary

The documented Devin v3 REST API exposes session messages and ordinary message steering, but no
documented structured elicitation-response endpoint. Cloud sessions continue to surface Devin's
message/status and accept a normal text reply; DevinX must not call private web endpoints or claim
native structured AskUserQuestion support for Cloud until Cognition documents that contract.

## Validation gates

- ACP capability advertisement and form request/response tests.
- Reject malformed, oversized, URL, cross-session, stale, and duplicate responses.
- Cancel ACP permission requests rather than auto-approving or terminating the process.
- Bridge authorization tests for read versus response grants and generic 404 non-disclosure.
- Mobile response-schema and interaction-state tests.
- Two consecutive prompts against one local session must reload ACP ownership between sends.
- CLI 3000.11.3 smoke tests cover native `elicitation/create`; a normal text response is not
  synthesized into a fake question card.
- Full lint, typecheck, test, build, dependency audit, and secret scan before release.
