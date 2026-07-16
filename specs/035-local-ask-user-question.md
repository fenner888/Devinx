# Local AskUserQuestion support

Status: Protocol-compatible, but not available from the tested production Devin CLI agent.

## Problem

ACP defines an agent-to-client `elicitation/create` request for structured user input. DevinX
Connector previously advertised no form elicitation capability and treated every agent-to-client
request as fatal. The Connector now implements that bounded protocol safely. However, production
verification with Devin CLI 3000.1.27 found that explicitly requesting `AskUserQuestion` completes
as an ordinary text response and does not emit `elicitation/create`. DevinX therefore must not
claim that Devin for Terminal currently exposes native AskUserQuestion cards. The implementation
remains dormant unless the running agent sends the documented ACP event.

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

Protocol handling is negotiated through a separate authenticated `bridge.features` request. An
updated mobile client treats a missing `bridge.features` method as an older Connector with question
support disabled; it must not call the elicitation endpoints or present that condition as a general
Connector outage. Updated Connectors return only bounded boolean feature flags derived from the
running ACP client; they never advertise question support when the production session adapter
cannot serve it. This additive handshake lets older iOS builds continue using the unchanged health
response while newer iOS builds can fail closed against Connector 0.1.0.

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
- Production smoke test records whether the installed Devin CLI actually emits
  `elicitation/create`; a normal text response is treated as unsupported agent behavior, not
  synthesized into a fake question card.
- Full lint, typecheck, test, build, dependency audit, and secret scan before release.
