# 012 — TLS identity and pairing transport

Status: bridge routes and native iOS pinning complete; scanner/desktop approval UI and real-device validation pending

## Explicit TLS provisioning

- Computer Connection setup invokes the fixed absolute `/usr/bin/openssl` executable with `shell: false` and fixed certificate subject/extensions.
- OpenSSL generates a 2048-bit RSA private key and one-year self-signed non-CA server certificate.
- The private key and certificate leave OpenSSL on dedicated inherited pipes (`/dev/fd/3` and `/dev/fd/4`). They are never written to a temporary file, command argument, environment variable, stdout, stderr, or log.
- Output, execution time, environment, working directory, and process termination are bounded.
- The bridge re-parses the certificate and key, proves they match, requires RSA >= 2048 bits, verifies the self-signature/non-CA status, caps lifetime, and derives the SHA-256 certificate fingerprint.
- The identity is persisted atomically as part of version 2 macOS Keychain state. Existing version 1 state migrates without rotating the Ed25519 bridge identity or session-handle key.
- A valid existing TLS identity is reused. Silent certificate rotation is prohibited; only an expired identity is replaced by this API.

## QR channel binding

The short-lived QR offer includes:

- canonical HTTPS bridge origin;
- TLS certificate SHA-256 fingerprint;
- Ed25519 bridge public key and SHA-256 fingerprint;
- bridge ID, pairing ID, 256-bit single-use pairing secret, and expiry.

The phone's HMAC-authenticated pairing request echoes the HTTPS origin and both fingerprints. The bridge consumes and rejects the offer if any channel binding differs. The signed approval receipt also includes the HTTPS origin and TLS fingerprint, so the phone verifies the final stored credential against the same QR trust anchors.

## Approval polling

- A valid submission creates an in-memory pending review and returns a separate random 256-bit poll token.
- Only a SHA-256 digest of the poll token is retained. Comparisons are constant-time and temporary token/proof buffers are overwritten.
- Desktop code can list only pairing ID, device ID/name, and expiry for explicit approve/deny UI. Pairing secret, poll token, public key, endpoint, proof, and fingerprints are not exposed in review summaries.
- Pending status requires the poll token. Approval receipts are retrievable once and expire quickly; denial, expiry, wrong bridge/token, and replay all return generic 404.
- Registration persists before an approved receipt becomes pollable. A persistence failure never creates an approved network response.

## HTTPS routes

- `POST /v1/pair/submit` accepts the Zod-validated HMAC request and returns only pending status, expiry, and poll token.
- `POST /v1/pair/status` accepts the Zod-validated bridge/pairing IDs and poll token, returning pending, one-time approved receipt, or generic 404.
- Pairing routes inherit TLS 1.3, exact Host, no-Origin/no-cookie, body/time/concurrency limits, and receive separate per-peer submit and status-poll rate limits so brute-force submissions stay strict without breaking normal polling.
- Desktop approval is not exposed as a network endpoint.

No real macOS Keychain item or persistent listener was created during automated validation. Tests use memory-backed state, ephemeral loopback ports, and generated test identities.
