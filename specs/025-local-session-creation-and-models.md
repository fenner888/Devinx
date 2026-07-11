# 025 — Local session creation and dynamic model controls

Status: active implementation

## Product contract

Cloud and Computer are separate composer destinations. Cloud retains the Devin API controls it
actually supports: repository, playbook, attachments, and Devin mode. Computer uses only options
reported or observed by the paired Devin installation: approved workspace, model, and future ACP
configuration selectors. The app must never present a Cloud repository as a local workspace or a
local model selector as a Cloud API model promise.

When both connections are configured, Home shows an explicit destination selector. Cloud-only and
Computer-only modes select their sole destination automatically. The compact composer follows the
reference structure: prompt and its primary controls live in one surface; destination and workspace
selectors sit directly beneath it without another outer card.

## Connector contract

The phone never sends a filesystem path, raw session ID, CLI argument, or guessed model. The
Connector derives workspace and model choices from the reviewed Devin session store, returns only
sanitized labels plus deterministic opaque handles/IDs, and resolves workspace handles locally.

New methods:

- `session.create_options` requires `session:metadata:read` and returns bounded workspace and model
  choices without paths.
- `session.create` requires the separate `session:create` grant, accepts an opaque workspace handle,
  an optional model ID returned by `session.create_options`, and a bounded prompt.

Creation executes ACP `session/new` with the resolved local working directory and no phone-supplied
MCP servers. If a model is selected, the Connector validates the new session's dynamic
`configOptions`, finds the `model` selector and exact offered value, applies it with
`session/set_config_option`, and only then sends the prompt. Unsupported or stale choices fail
closed. The response exposes only a new opaque session handle.

Existing session lists and history may display a sanitized model label read from the reviewed store.
Raw paths, backend type, permission mode, metadata, config extensions, and private ACP errors remain
Mac-local.

## Security and compatibility

- Every request remains signed, replay-protected, rate-limited, and Zod validated server-side.
- Unauthorized workspace handles, devices, permissions, or session scopes return generic `404`.
- Creation is independently revocable from content-read and prompt-send permission.
- Existing protocol-v2 clients remain compatible: the health response does not gain required fields,
  and pairing does not grant creation by default.
- No new dependency is added and no model list is hardcoded into the app.

## Validation

- Synthetic ACP tests prove new-session ordering, exact config validation, and no prompt after a
  failed model selection.
- Service tests cover permission separation, opaque workspace/session handles, IDOR, rate limits,
  and response minimization.
- Store tests cover schema drift, hidden sessions, unique bounded workspaces/models, and path
  non-disclosure.
- Mobile tests cover distinct Cloud/Computer pickers, destination switching, local creation, and
  dynamic model labels.
- Physical validation creates a harmless session over LTE/Tailscale, confirms the selected model on
  the Mac, receives a reply, and reloads its history without exposing a path.
