# Phase 3F — macOS Keychain State and Device Registry

Status: implementation validated with fake Keychain and in-memory fixtures. The real user Keychain has not been written.

## Storage decision

The bridge identity, session-handle key, and paired-device authorization records live in one versioned generic-password item in the user's macOS Keychain. No private bridge material is written to a repository, dotfile, preferences plist, log, environment variable, command-line argument, or mobile device.

The version 2 stored state contains:

- stable bridge ID;
- Ed25519 private key in PKCS#8 form;
- matching Ed25519 public key in SPKI form;
- independent 256-bit session-handle HMAC key; and
- up to 100 validated paired-device public records and server-side grants; and
- an optional validated self-signed TLS certificate/private-key pair after explicit Computer Connection setup.

Version 1 state is cryptographically validated, migrated to version 2, and persisted atomically without rotating the bridge identity or session-handle key.

## `security` subprocess rules

- Invoke the fixed absolute `/usr/bin/security` executable with `shell: false`.
- Use fixed service/account identifiers owned by DevinX.
- Read with `find-generic-password ... -w`.
- Write with `add-generic-password ... -U -T <trusted-app> -w`, keeping `-w` last so the value is supplied through stdin rather than process arguments.
- Default the trusted-app value to an empty path, which removes the insecure default trust granted to the `security` tool itself. A future signed launcher may explicitly provide its absolute signed application path after packaging review.
- Delete with `delete-generic-password`.
- Start from the user's home directory with an allowlisted environment.
- Discard stderr, bound stdout, apply a timeout, and expose generic errors only.
- Treat exit code 44 as item-not-found, confirmed on the development Mac without reading an existing item.

## Validation and atomicity

- Parse every loaded state with Zod.
- Re-import the private/public keys and prove they are matching Ed25519 keys before use.
- Require exactly 32 decoded bytes for the session-handle key.
- Require unique device IDs and matching bridge IDs.
- Re-parse TLS PEM, require a matching RSA key of at least 2048 bits, require a self-signed non-CA certificate, verify the stored fingerprint and validity fields, and cap certificate lifetime.
- Serialize all device mutations through a write queue.
- Persist the complete next state successfully before replacing the in-memory authorization view.
- Refuse duplicate registration so a new pairing cannot overwrite an existing device public key.
- Return cloned device records so consumers cannot mutate authorization state by reference.

Pairing approval is asynchronous and does not return an approved receipt until device registration has persisted. A Keychain failure leaves the prior in-memory authorization state unchanged.

## Device administration

The registry provides synchronous read access for request authorization and serialized asynchronous operations for:

- unique device registration;
- permission/session-scope replacement; and
- revocation.

Desktop UI, last-used timestamps, signed credential/certificate rotation, recovery/reset confirmation, and real Keychain access prompts remain packaging and real-device work.
