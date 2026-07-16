# Local AskUserQuestion support

Status: Implemented direction for the next Connector and iOS build.

## Problem

Devin for Terminal can pause a prompt turn to request structured user input. In ACP this is an
agent-to-client `elicitation/create` request. DevinX Connector previously advertised no form
elicitation capability and treated every agent-to-client request as fatal, which ended the ACP
process instead of letting the iPhone answer the question.

## Supported contract

- Connector advertises ACP form elicitation support only. URL elicitation remains unsupported.
- Connector accepts session-scoped `elicitation/create` requests whose form contains bounded
  primitive fields: string, number, integer, boolean, or a string multi-select.
- The mobile app polls for one pending question for the opened local session and may explicitly
  accept, decline, or cancel it.
- Accepted content is validated again against the original requested schema on the Mac before it
  is returned to Devin. Field names and raw ACP request IDs are never exposed as authority-bearing
  bridge identifiers.
- `session/request_permission` is not an AskUserQuestion request. Until a dedicated permission UI
  is specified, Connector answers it with `cancelled`; it never auto-approves tool execution.
- Unknown agent-to-client methods receive a JSON-RPC method-not-found error and do not crash the
  Connector runtime.

ACP marks elicitation as unstable. The implementation is isolated behind strict schemas and the
exact `Waiting for your answer` activity transition so it can fail closed if the wire contract
changes. The existing bridge health shape remains unchanged; this preserves compatibility between
the updated Connector and iOS builds that predate question support.

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
- Full lint, typecheck, test, build, dependency audit, and secret scan before release.
