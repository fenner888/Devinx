# 029 — Existing Computer session model controls

Status: implementation in progress; coordinated Connector and iOS physical
validation required before the next TestFlight upload

## Product contract

An existing Computer session composer shows the current model family,
reasoning/speed variant, paired Mac, and sanitized workspace name. The model and
variant controls use the same live ACP catalog presentation as Computer session
creation. Workspace is context, not a picker: changing workspaces starts a new
session rather than silently redirecting an existing conversation.

Selecting a model or variant applies that exact ACP model ID to the next sent
turn. The phone never synthesizes a model ID and never presents a selectable
value that was not returned by `session.create_options`. If the live catalog is
unavailable, the current sanitized model remains visible but the picker is not
interactive.

Cloud sessions remain a separate contract and continue to show only the mode
and repository controls supported by the Cloud API.

## Connector contract

`session.prompt` accepts an optional, bounded `modelId` under the existing
`session:prompt:send` permission. The Connector resolves the opaque session
handle, validates the model against that loaded ACP session's live model
selector, applies it with `session/set_config_option`, and only then starts the
prompt. A stale or unavailable model fails closed without sending the prompt.

If an in-use Desktop session requires DevinX to create a continuation, the
Connector applies the selected model to the continuation before embedding
history and sending the turn. Existing request signing, replay protection,
write-rate limiting, session-scope authorization, generic unauthorized `404`,
and post-turn ownership release remain unchanged.

## Validation

- ACP tests prove exact model selection occurs before prompting and rejects a
  stale model without prompting.
- Runner tests cover direct and continuation model forwarding.
- Service and mobile boundary tests cover Zod validation and exact-ID transport.
- Component tests cover model family, reasoning/speed, Mac, workspace, picker
  dismissal, and send behavior.
