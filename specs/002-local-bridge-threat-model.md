# Phase 3A — Local Bridge Threat Model

Status: required security gate. No LAN, VPN, tunnel, or remote listener may be implemented until this model is reviewed and the open decisions are resolved.

## Security objective

Allow an explicitly paired phone to observe and, only with separately granted permissions, steer supported Devin CLI sessions without exposing Devin credentials, arbitrary shell execution, unrelated files, or session content to unauthenticated devices or DevinX-operated infrastructure.

## Assets

- Devin CLI authentication state and refresh credentials.
- Local source code, repository paths, diffs, and uncommitted changes.
- Prompts, responses, reasoning, tool inputs/outputs, and attachments.
- Local session identifiers and metadata.
- Bridge private keys and per-device credentials.
- Device permission grants and revocation state.
- Audit events and connection diagnostics.
- Desktop process availability and resource capacity.

## Trust boundaries

```text
[Untrusted network / local LAN / VPN]
                |
        authenticated encryption
                |
[Desktop Bridge process] -- validated JSON-RPC --> [devin acp child]
                |                                      |
       OS credential store                     local repos/session state
```

The phone, network, bridge, ACP child, filesystem, and future relay are distinct trust boundaries. Tailscale or a tunnel may protect transport routing, but neither replaces bridge-level authentication and authorization.

## Principals

- Desktop owner/operator.
- Explicitly paired mobile device.
- Revoked or lost mobile device.
- Unauthenticated LAN peer.
- Malicious webpage attempting DNS rebinding or CSRF-like requests.
- Compromised mobile app/device.
- Compromised or malicious local repository content.
- Compromised future relay or tunnel provider.
- Local unprivileged process on the desktop.

## Non-negotiable controls

### Listener and transport

- Bind to loopback only by default.
- Refuse non-loopback binding unless authentication and encryption are configured.
- No cleartext LAN mode, even when a password is present.
- Pair by explicit desktop approval using a short-lived QR or one-time code.
- Pin the bridge public key during pairing or use an equivalent authenticated key exchange.
- Generate a unique credential/key pair per mobile device.
- Authenticate both bridge and phone on every protected request/connection.
- Include protocol version, connection identity, timestamp/expiry, and nonce or sequence in authenticated messages.
- Reject replayed, expired, out-of-order, oversized, or excessively concurrent requests.
- Protect browser-reachable transports against CSRF, Origin confusion, Host-header attacks, and DNS rebinding.

### Authorization

- Server-side authorization on every protected operation; client UI checks are not security controls.
- Default every new device to read-only session metadata access.
- Separate grants for session content, prompt/send, create, cancel/close, handoff, attachment transfer, and approval response.
- Scope grants to a bridge/computer and, where feasible, workspace/session boundaries.
- Return 404 for an unauthorized resource so its existence is not disclosed.
- Re-check authorization after reconnect and before every mutation.
- Provide desktop-side device listing, last-used time, permissions, revocation, and rotation.

### Validation and process isolation

- Validate every inbound endpoint/request and every ACP response at the boundary.
- If implemented in TypeScript, use Zod schemas for all endpoint and protocol inputs.
- Launch only the configured Devin CLI path with the fixed `acp` subcommand; never concatenate or evaluate phone-provided shell text.
- Pass prompts as protocol data, not command-line fragments.
- Use an allowlisted child environment and never forward bridge secrets to the CLI unless the supported auth contract explicitly requires it.
- Apply request size, attachment size/type, rate, concurrency, and execution-time limits.
- Treat repository instructions, hooks, MCP output, and agent messages as untrusted content.
- Never silently install hooks, skills, plugins, certificates, launch agents, or firewall rules.

### Secret and data handling

- No hardcoded credentials or secrets.
- Store desktop private material in the OS credential store with restrictive file permissions for non-secret metadata.
- Store mobile pairing credentials in iOS Keychain/Secure Store, never AsyncStorage or localStorage.
- Never send the user's Devin CLI credential or refresh token to the phone.
- Do not log prompts, responses, source, attachment names, command bodies, tokens, private paths, or raw ACP payloads.
- Audit only operation type, result, device ID, bridge ID, coarse timestamp, capability, and redacted error category.
- Cache local session content on mobile only after explicit product/privacy approval and with the same purge-on-disconnect guarantees as Cloud cache.
- A future relay must be unable to decrypt bridge traffic.

## Threat register

| Threat | Example | Required mitigation | Initial disposition |
|---|---|---|---|
| Unauthenticated LAN access | Peer lists sessions after bridge binds to `0.0.0.0` | Loopback default, mutual auth, TLS, firewall guidance | Must mitigate before LAN |
| Replay | Captured prompt request is resent | Nonce/sequence, short expiry, authenticated session binding | Must mitigate before mutation |
| Device theft | Lost phone still controls CLI | Per-device key, revocation, biometric/app lock evaluation | Must mitigate before pairing release |
| Credential theft | Bridge endpoint returns CLI auth | Never expose child credentials; redact env/errors | Prohibited design |
| Arbitrary command execution | Phone supplies executable or flags | Fixed executable/args, schema validation, no shell | Prohibited design |
| Cross-session IDOR | Device requests a session outside scope | Server authz every request, opaque IDs, 404 | Must test |
| DNS rebinding/CSRF | Website drives localhost bridge | Origin/Host validation, non-cookie auth, request signing | Must mitigate before browser-capable transport |
| Oversized payload DoS | Huge prompt/attachment exhausts desktop | Size/rate/concurrency/time limits | Must test |
| Malicious ACP output | Agent returns unexpected nested data | Response validation, bounded parsers, tolerant unknowns | Must test |
| Sensitive handoff | Uncommitted diff contains secrets | Explicit disclosure/confirmation; never automatic | Required UX gate |
| Hook abuse | Global hook exfiltrates tool input | No silent hook install; review source/scope | Deferred |
| Relay compromise | Relay reads session content | End-to-end encryption independent of relay | Remote access deferred |

## Permission matrix

| Capability | Default | User confirmation | Notes |
|---|---:|---:|---|
| Bridge health | Allow after pairing | Pairing only | No session data |
| Session metadata list | Read-only grant | Pairing permission screen | Minimize paths/titles |
| Session content | Deny | Explicit device grant | Proprietary content |
| Follow-up prompt | Deny | Explicit device grant; optional per-action confirmation | Mutation |
| Create session | Deny | Explicit device grant | Workspace selection must be bounded |
| Cancel/close | Deny | Explicit grant and confirmation | Destructive/interruption risk |
| Approval response | Deny | Separate high-risk grant and per-action confirmation | Never auto-approve |
| Attachment transfer | Deny | Separate grant and per-transfer confirmation initially | Size/type/path limits |
| Cloud handoff | Deny | Per-action disclosure and confirmation | May include uncommitted diff |

## Deferred surfaces

- Public Cloudflare or arbitrary reverse-proxy access.
- DevinX-operated relay.
- Cross-platform background service installers.
- Automatic approvals.
- Direct Devin Desktop state access.
- Attachment upload/download.
- Remote terminal or arbitrary filesystem browser.
- Silent launch-at-login or auto-update.

## Security verification gates

- Authentication matrix: unauthenticated, valid, expired, revoked, wrong-device, wrong-bridge.
- Authorization matrix: every role/grant by every endpoint, including cross-session and cross-computer attempts.
- Replay, nonce, expiry, reconnect, and cursor-resume tests.
- DNS rebinding, Host/Origin, and CSRF tests for any HTTP/WebSocket transport.
- Rate, payload, concurrency, and slow-client tests.
- Secret scan of source, logs, fixtures, crash reports, and packaged artifacts.
- Fuzz/schema tests for every inbound request and ACP response.
- Independent security review before remote access or approval actions.

## Open decisions

1. Production bridge language and packaging model.
2. Pairing key exchange and certificate/public-key pinning design.
3. Whether LAN discovery uses Bonjour, manual host entry, or both.
4. Whether local session titles/paths are shown before the content permission grant.
5. Mobile cache policy for local sessions.
6. CLI licensing/terms for third-party invocation and whether bundling is prohibited.
7. Minimum supported Devin CLI and ACP versions.
8. Whether the first bridge release supports Tailscale or LAN only.
