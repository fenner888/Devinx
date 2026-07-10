# Phase 3B — Desktop Bridge Runtime Decision

Status: accepted for the protocol/security core. Network transport and final macOS packaging remain gated separately.

## Decision

Implement the first Desktop Bridge core in strict TypeScript on the repository's pinned Node runtime (`>=20.19.4`) using only Node built-ins and the existing pinned Zod dependency.

The core is deliberately transport-independent. It validates signed request envelopes, canonicalizes signed data, authenticates a paired device, enforces expiry and replay protection, validates method-specific bodies, and checks server-side permissions before any handler can reach ACP.

The existing dependency-free `scripts/bridge/discover-acp.mjs` remains a compatibility probe. Production ACP process management will be a separate adapter behind the validated core and will launch only the configured Devin executable with the fixed `acp` argument and an allowlisted environment.

## Why this runtime

- It satisfies the existing strict-TypeScript and Zod boundary rules.
- Node provides Ed25519, secure randomness, subprocess, TLS, and HTTP primitives without another package.
- The bridge can share protocol fixtures and types with the Expo app without moving secrets or Devin credentials into the mobile bundle.
- No package is added during this phase, avoiding dependency and supply-chain expansion.
- A transport-independent core can later sit behind a signed macOS launcher or packaging wrapper without changing its authorization contract.

## Packaging boundary

The development bridge may run from the repository with the pinned Node version. Public distribution must not require users to clone the repository or install development dependencies.

Before public release, choose and validate one signed/notarized macOS delivery model:

1. a signed application bundle that embeds the required runtime and bridge output; or
2. a signed native launcher that owns Keychain and lifecycle while hosting the same validated protocol core.

The final artifact must not bundle the Devin CLI unless Cognition's supported distribution terms explicitly permit it. By default, the bridge locates a user-installed CLI and displays a clear compatibility error when it is absent or unsupported.

## Initial protected methods

| Method | Required grant | Mutation | Initial status |
|---|---|---:|---|
| `bridge.health` | `bridge:health` | No | Core contract |
| `session.list` | `session:metadata:read` | No | Core contract; ACP execution pending approved probe |
| `session.load` | `session:content:read` | No | Schema reserved; handler blocked until disposable-session test |
| `session.prompt` | `session:prompt:send` | Yes | Schema reserved; handler blocked until explicit mutation phase |

Defining a method schema does not enable it. A production handler must exist, the connected CLI must advertise the required capability, and the paired device must hold the matching server-side grant.

## Signed request contract

Every protected request includes:

- protocol version;
- bridge and device identifiers;
- unique request identifier;
- issued and expiry times;
- a random nonce;
- an allowlisted method;
- a method-specific Zod-validated body; and
- an Ed25519 signature over a deterministic canonical representation.

The bridge rejects malformed, expired, future-dated, overlong, replayed, incorrectly signed, revoked-device, wrong-bridge, and unauthorized requests before dispatch. Authentication and authorization failures use the same not-found response so resource existence is not leaked.

## Non-goals for this phase

- No HTTP, WebSocket, LAN, VPN, tunnel, Bonjour, or relay listener.
- No real session listing without user approval.
- No session content load, prompt, permission response, hook installation, or handoff.
- No Keychain writes or persistent credentials yet.
- No launch agent, login item, firewall rule, certificate installation, or auto-update.

## Exit criteria

- Every request boundary is parsed with Zod.
- Signature coverage is deterministic and tested against body/key-order changes.
- Wrong bridge/device, revoked device, invalid signature, expiry, replay, invalid body, and missing grant fail closed.
- No request body, path, prompt, key, signature, or session identifier is logged.
- Root lint, strict typecheck, tests, build, and security audit remain green.
