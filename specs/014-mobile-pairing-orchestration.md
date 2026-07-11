# 014 — Mobile pairing orchestration

Status: protocol workflow and scanner UI implemented and unit validated; desktop approval runner and real Mac/iPhone validation pending

## Workflow

The mobile pairing coordinator accepts only a bounded strict JSON QR payload matching the bridge protocol. Before it creates a device key or sends data, it:

- validates the protocol version, IDs, transport-security mode, mode-matched canonical HTTP or HTTPS origin, Ed25519 SPKI lengths, TLS and bridge fingerprints, single-use secret, and expiry;
- limits the QR pairing window to fifteen minutes including clock-skew tolerance;
- asks the native CryptoKit module to validate and fingerprint the bridge Ed25519 SPKI, then compares it with the QR fingerprint; and
- rejects a duplicate bridge or a ninth paired computer.

The coordinator then creates a new Keychain-backed Ed25519 device identity, derives a non-secret device ID from the opaque key ID, and proves possession of the QR secret with native HMAC-SHA-256 over the same recursively sorted canonical JSON used by the desktop bridge.

The request is sent only through the QR-selected transport. In the v1 product this is strict `100.64.0.0/10` HTTP over Tailscale WireGuard; legacy QR-pinned HTTPS remains compatibility-only for authenticated migration and is not exposed as a setup choice. After submission, the coordinator keeps the poll token inside the async workflow, exposes only a small presentation status callback, and polls within the server-signed approval window. It accepts only pending or one-time approved response schemas and never extends an approval deadline from a poll response.

## Approval and persistence

The approved receipt must match the QR bridge ID, bridge key fingerprint, transport-security mode, endpoint, applicable TLS fingerprint, and newly created device ID. The native CryptoKit module verifies its Ed25519 signature over canonical JSON before the version 3 credential can enter Secure Store. Legacy version 2 credentials migrate only as pinned-TLS credentials.

The credential includes only the device public key and opaque Keychain key ID, plus the two bridge pins and server-approved grants. QR secrets, HMAC proofs, poll tokens, and receipt signatures are never stored in the registry or exposed through React connection context.

Only one pairing workflow may run in-process at once. Cancellation, denial, expiry, malformed responses, signature mismatch, transport failure, duplicate state, and Secure Store failure erase the temporary native identity. If erasure itself fails, the operation reports a secure-cleanup failure rather than claiming a clean rollback.

## Remaining gates

- Add a desktop setup/approval runner so the Mac can display an offer and approve or deny locally.
- Validate certificate mismatch, local-network prompt, camera denial, cancellation, approval, storage, cold start, and revocation on a real Mac and iPhone.
