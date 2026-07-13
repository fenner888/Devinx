# Phase 3A — Devin CLI / ACP Compatibility Baseline

Observed July 10 and refreshed July 13, 2026 on macOS. This report contains only version information and capability names returned during ACP initialization. It contains no session identifiers, titles, paths, prompts, messages, credentials, auth-method details, or raw metadata.

## Tested implementation

- Devin CLI: `2026.8.18 (16737566)`
- ACP wire protocol requested: `1`
- ACP wire protocol negotiated: `1`
- Reported agent implementation: `affogato 0.0.0-dev`
- Probe: `npm run bridge:discover`
- Machine-readable fixture: `specs/bridge-compatibility/cli-2026.8.18-acp.json`

The July 13 value-free probe used Devin CLI `3000.1.27 (0d4bf12e)` and returned the same five
capability names recorded below with no unknown capabilities. The installed CLI's versioning scheme
has changed since the original fixture; the product continues to negotiate capabilities on every
connection rather than treating either marketing version as a compatibility guarantee. No session
schema or account content was requested during the refresh.

Two repeated probes after the schema-mode implementation returned the capability set below. An earlier probe from the same reported CLI version also returned audio and MCP HTTP/SSE capabilities. The agent implementation can therefore vary without a CLI marketing-version change; every connection must negotiate and gate features from the live initialization response.

## Advertised capabilities

| Capability | Phase implication |
|---|---|
| `sessionCapabilities.list` | A supported session-discovery path exists; no private CLI database parsing is justified. |
| `loadSession` | The bridge may be able to load history after an explicit user selection and content grant. Exact request/update behavior must be proven in an isolated test workspace. |
| `sessionCapabilities.additionalDirectories` | Multi-root access exists but materially expands filesystem scope; defer until workspace permissions and path-boundary tests exist. |
| `promptCapabilities.image` | The ACP agent can accept image prompt content, but mobile attachment transfer remains unsupported until transport and size/path rules are specified. |
| `promptCapabilities.embeddedContext` | Embedded context is available but must be treated as untrusted, size-bounded content. |

## Not advertised

The initialization response did not advertise:

- `sessionCapabilities.resume`
- `sessionCapabilities.close`
- `sessionCapabilities.delete`
- `sessionCapabilities.fork`
- `promptCapabilities.audio`
- `mcpCapabilities.http`
- `mcpCapabilities.sse`

Absence means unavailable. DevinX must not call or emulate these operations against this CLI version. `loadSession` may cover the product's reconnect requirement, but that is an inference to test, not a contract to assume.

## Product conclusion

The Phase 3 architecture is feasible enough to continue to a read-only session-list experiment. The production bridge should adapt negotiated ACP rather than mirror Hermex REST endpoints or inspect Devin storage. Feature availability must be computed per connected computer because users may run different Devin CLI versions and agent implementations.

## Session-list schema probe

An explicit, opt-in `--session-schema` mode is implemented and covered by a synthetic ACP server. It calls `session/list` and records only:

- request success/failure;
- item count;
- recognized public response/session field presence;
- unknown field counts, never unknown field names;
- pagination presence;
- whether IDs, titles, paths, and timestamps are present, without printing their values.

The synthetic test deliberately returns secret IDs, paths, titles, timestamps, cursors, extension fields, and `_meta` data and verifies that none appears in the report. A real-account invocation is intentionally pending explicit user approval. Do not call `loadSession` until a dedicated disposable test workspace/session is selected. Do not send prompts or answer permission requests during discovery.
