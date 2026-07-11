# Authorization matrix

Reviewed against source checkpoint `5643f30` on July 11, 2026. This matrix covers the user-controlled Connector HTTP boundary. Devin Cloud authorization remains enforced by the Devin API and the user's credential scopes.

| Method | Required device grant | Input validation | Resource binding | Unauthorized result | Rate limit class |
|---|---|---|---|---|---|
| `bridge.health` | `bridge:health` | strict empty Zod object | paired device from signed envelope | indistinguishable `404` | health |
| `device.revoke` | `bridge:health` | strict empty Zod object | requesting device revokes itself | indistinguishable `404` | mutation |
| `session.list` | `session:metadata:read` | strict optional bounded cursor | opaque handles minted for this bridge | indistinguishable `404` | session list |
| `session.load` | `session:content:read` | strict local-handle schema | handle must have been listed for this device/session scope | indistinguishable `404` | session history read |
| `session.prompt` | `session:prompt:send` | strict handle plus bounded non-empty text | handle must have been listed for this device/session scope | indistinguishable `404` | mutation |

## Request gates

Every method passes the same server-side sequence before its handler runs:

1. Parse the complete request envelope and method-specific body with Zod.
2. Find the paired device without exposing whether an unknown device exists.
3. Verify timestamp freshness, nonce uniqueness, request signature, and method permission.
4. Bind local-session actions to an opaque handle previously issued by this bridge.
5. Apply peer and per-device/method rate limits.
6. Return only schema-minimized output.

Client-side permission checks only control presentation. The Connector remains authoritative and re-evaluates the current device record on every request. Removing `session:prompt:send` therefore blocks sending even if the phone retained an older pairing receipt.

## Cross-device and IDOR cases

- A signature from device A cannot authenticate as device B.
- A handle invented by, listed to, or copied from another device is rejected.
- A revoked device cannot call health, list, load, prompt, or revoke again as an authenticated device.
- Read permission does not imply send permission.
- Message sending cannot invoke tool approval, filesystem, command, attachment, session-create, archive, or termination actions.

Automated evidence lives in `tests/bridge/security-core.test.ts`, `tests/bridge/bridge-service.test.ts`, `tests/auth/computer-bridge.test.ts`, and the pairing/device-management suites.
