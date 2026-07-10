# Phase 3B — Computer Pairing and Device Credential Contract

Status: offline core implementation. Transport, persistence, and user-interface wiring remain pending.

## Security properties

- Pairing begins only after the desktop owner asks the bridge to display a QR offer.
- Each offer contains a random 256-bit secret, expires quickly, is memory-only, and is single-use after a valid request.
- The QR contains the bridge's long-term Ed25519 public key and SHA-256 fingerprint so the phone can pin the bridge identity independently of discovery or routing.
- The phone creates its own Ed25519 key pair and proves possession of the QR secret with HMAC-SHA-256 over the complete pairing request.
- The desktop must explicitly approve the pending device before a credential becomes active.
- Approval creates a unique per-device public-key record with only `bridge:health` and `session:metadata:read` grants.
- Device registration is atomic and refuses an existing device ID, preventing a new pairing from overwriting a trusted public key.
- Content, prompt/send, create, close, approval response, handoff, and attachment grants are never granted automatically during pairing.
- The bridge signs the approval receipt with its pinned Ed25519 identity so the phone can verify it paired with the same computer shown in the QR.
- A consumed, expired, denied, or over-attempted offer cannot be reused.
- Revocation changes the server-side device record to `revoked`; the signed-request core rejects it with the same 404 response used for other unauthorized requests.

## Offline flow

```text
Desktop owner requests QR
        |
        v
short-lived offer: bridge ID + public key + fingerprint + pairing ID + secret
        |
        v
phone sends public key + device identity + HMAC proof
        |
        v
desktop displays pending device name and asks owner to approve or deny
        |
        v
approval creates read-only device record + bridge-signed receipt
```

The pairing secret authenticates the initial phone request; it is not a long-term credential. Subsequent protected requests use the phone's Ed25519 key and the signed request envelope defined in `004-local-bridge-runtime.md`.

## Transport requirements

The offline contract does not make cleartext pairing safe. When transport is added:

- the phone must verify the QR-pinned bridge identity before sending the pairing request;
- the channel must be encrypted;
- Host, Origin, DNS-rebinding, request-size, rate, concurrency, and timeout controls must run before parsing large bodies;
- pairing routes must be rate-limited even though the secret is high entropy;
- no cookie or ambient browser credential may authorize pairing;
- generic failures must not distinguish unknown, expired, denied, or invalid-proof offers.

## Persistence requirements

- Bridge private identity: macOS Keychain, non-exportable where the chosen API permits.
- Device public records and grants: integrity-protected local store with restrictive permissions; no private phone key.
- Phone private device key: iOS Keychain/Secure Store, never AsyncStorage or localStorage.
- Pairing offers, secrets, failed proof counters, and pending requests: memory only.
- Logs and crash reports: never include QR payloads, pairing secrets, proofs, device public keys, device names, or signed receipts.

## Review gates before a listener

- Confirm whether the QR-pinned signing identity is also the TLS identity or signs a separate ephemeral transport key/certificate.
- Confirm the macOS Keychain accessibility class and reset/recovery behavior.
- Confirm the desktop approval UI and exact device-name disclosure.
- Confirm that read-only session metadata is acceptable as the default grant.
- Run brute-force, replay, expiry, duplicate-device, denial, revocation, and wrong-bridge tests through the actual transport.
