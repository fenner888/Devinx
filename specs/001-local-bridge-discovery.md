# Phase 3A — Local Bridge Discovery and Feasibility

Status: active discovery. This phase may inspect public CLI capabilities but must not expose a network listener, read conversation content by default, mutate a session, install global hooks, or change mobile auth/API behavior.

## Product decision

The first public DevinX release supports three valid configurations:

1. Cloud only — direct TLS connection from DevinX to the Devin API.
2. Computer only — paired connection to one or more user-controlled Desktop Bridges.
3. Both — Cloud and local sessions displayed together with explicit origin and computer identity.

Internal development and TestFlight builds remain phased. A Computer Connection is additive; Cloud users are never required to install a bridge, and local-only users are never required to provide a Devin Cloud API credential.

## Supported integration boundary

The preferred local boundary is the installed Devin CLI's documented Agent Client Protocol subprocess:

```text
DevinX mobile
    |
    | future authenticated, encrypted bridge transport
    v
DevinX Desktop Bridge
    |
    | ACP v1 JSON-RPC over stdio
    v
devin acp
```

The bridge launches a fixed executable and fixed `acp` argument. It does not accept arbitrary commands from the phone. Direct Devin Desktop integration is allowed only if Cognition publishes a supported interface; installing the CLI through Desktop does not make Desktop's private state an integration API.

Primary references, reviewed July 10, 2026:

- <https://docs.devin.ai/cli/reference/commands>
- <https://docs.devin.ai/cli/extensibility/hooks/overview>
- <https://docs.devin.ai/cli/handoff>
- <https://agentclientprotocol.com/get-started/architecture>
- <https://agentclientprotocol.com/protocol/v1/session-list>
- <https://agentclientprotocol.com/updates>
- <https://github.com/agentclientprotocol/agent-client-protocol>
- <https://hermexapp.com/setup>
- <https://github.com/uzairansaruzi/hermex/blob/master/CONTRACT_TESTS.md>

## Current verified baseline

The development machine currently reports:

- Devin CLI executable: discoverable on `PATH`.
- Devin CLI version: `2026.8.18 (16737566)`.
- `devin acp`: documented by the installed CLI as an ACP server over stdio.
- Stable ACP wire protocol: version `1`; optional operations are capability-gated.

The sanitized initialization probe negotiated ACP v1 successfully. This build advertises `sessionCapabilities.list` and `loadSession`, but not `sessionCapabilities.resume` or `sessionCapabilities.close`. See `003-local-bridge-compatibility.md`; absence is treated as unsupported.

This is a development observation, not a compatibility promise. Production code must negotiate the protocol version and capabilities at runtime and maintain a tested-version matrix.

## Discovery matrix

| Capability | Supported public surface | Discovery action | Phase 3A rule |
|---|---|---|---|
| CLI identity | `devin version` | Capture version only | Required |
| ACP initialization | `devin acp` | Send `initialize` with ACP v1 and empty client capabilities | Required; safe default probe |
| Session discovery | ACP `session/list` or `devin list --format json` | Record capability/shape without printing session values | Capability-gated; no content in default probe |
| Session resume | ACP `session/resume` | Record advertised support | Do not invoke in default probe |
| Session history | ACP `session/load` or ATIF export | Document availability and limits | No private storage parsing |
| New local session | ACP `session/new` | Record advertised support | Mutating test requires explicit test workspace |
| Follow-up prompt | ACP `session/prompt` | Record supported updates and stop reasons | Deferred until read-only bridge is secure |
| Cancellation/close | ACP cancellation and `session/close` | Record capability | Deferred mutation |
| Permission requests | ACP bidirectional request | Record schema and timeout behavior | Never auto-approve |
| Hooks | Documented lifecycle hooks | Record event schemas | Never install globally without approval |
| Cloud handoff | `/handoff` | Document context/diff disclosure | Explicit confirmation required |
| Attachments | No assumed bridge contract | Seek supported ACP/CLI surface | Unsupported until proven |
| Desktop sessions | No documented Desktop session API | Monitor official roadmap | No scraping or injection |

## Safe discovery probe

Create a dependency-free Node script under `scripts/bridge/` that:

- resolves the CLI executable from `DEVIN_CLI_PATH` or `PATH`;
- runs `devin version` with a short timeout;
- starts exactly `devin acp` with a minimal environment;
- sends only ACP `initialize` using protocol version `1` and empty client capabilities;
- validates the JSON-RPC response shape;
- prints only CLI version, negotiated protocol version, implementation metadata, recognized capability names, and the count of unknown capability fields;
- redacts all other `_meta` values and never calls `session/list` by default;
- terminates the child on success, timeout, signal, parse error, or protocol mismatch;
- never prints the child environment or stderr without redaction.

The probe now includes an explicit `--session-schema` mode. It calls only the first page of `session/list` after initialization and only when `sessionCapabilities.list` is advertised. Its report contains the item count, pagination presence, recognized public schema fields, and an unknown-field count. It never emits session IDs, titles, paths, timestamps, cursor values, extension field names, or `_meta` keys/values.

```bash
npm run bridge:discover -- --session-schema
```

This mode is covered with a synthetic CLI fixture. Running it against a real account remains a user-approved checkpoint because even a value-free count and field-presence report confirms private session metadata exists.

## Compatibility policy

- Pin each tested Devin CLI version in a compatibility fixture.
- Treat the negotiated ACP wire version as authoritative.
- Treat every optional method as unavailable unless advertised.
- Tolerate unknown response fields but fail closed on missing required fields.
- Never infer wire compatibility from the CLI marketing version alone.
- Keep Cloud and local session identifiers in separate namespaces.
- A CLI update that removes or changes a required capability disables only the affected local feature; Cloud mode remains functional.

## Phase 3A exit criteria

- Threat model reviewed before any listener is implemented.
- Safe initialization probe passes on the pinned macOS CLI version.
- Sanitized capability fixture and compatibility report are committed.
- Session discovery path is proven without parsing undocumented files.
- Unsupported operations are explicitly listed.
- Production bridge language/runtime decision is recorded separately after the probe.
- No new mobile dependency, auth change, or App Store privacy claim is introduced in this phase.

## Kill criteria

Stop implementation and request product/security direction if:

- supported ACP cannot enumerate or resume the user's local sessions;
- useful operation requires private database/file parsing;
- the CLI cannot be invoked by a third-party bridge under its license or terms;
- authentication requires exporting Devin credentials to the mobile app;
- the bridge cannot prevent arbitrary command execution;
- the proposed network transport cannot provide per-device authentication, revocation, replay protection, and encryption.
