# 010 — iOS device signing

Status: implemented; physical pairing has validated native signing, with release-candidate revoke/replay regression still required

## Purpose

Computer Connection requests must be signed by a per-install device identity without exposing the signing private key to React Native, logs, backups, or bridge traffic.

## Design

- `modules/devinx-device-crypto` is a local Expo native module. It is application code, not a third-party dependency, SwiftUI view, new app, or system overlay.
- The module uses CryptoKit Ed25519 (`Curve25519.Signing`) for device signatures.
- The 32-byte raw private key is stored as an iOS generic-password Keychain item because CryptoKit Curve25519 keys do not have a direct `SecKey` representation.
- Keychain items use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` and the data-protection Keychain. They neither synchronize nor migrate to another device.
- JavaScript receives only an opaque UUID key ID and RFC 8410 SubjectPublicKeyInfo-encoded public key. Private key bytes never cross the native boundary.
- All native results are validated by Zod at the JavaScript boundary.
- Signing, verification, and HMAC inputs are non-empty and limited to 1 MiB. Public keys, signatures, secrets, and key IDs are length- and alphabet-validated.
- Disconnect-all deletes the module's complete Keychain namespace before deleting the paired-computer registry. The registry is retained when native deletion fails so the UI cannot claim a successful secure wipe.
- The module is iOS-only in this phase. Expo Go cannot load it; Computer Connection requires a DevinX development or release build.

## Native API

- `createDeviceIdentity()` creates and stores a key, returning `{ keyId, publicKeySpki }`.
- `sign(keyId, message)` signs canonical UTF-8 request bytes.
- `verify(publicKeySpki, message, signature)` verifies the desktop bridge approval receipt.
- `hmacSha256(secret, message)` proves possession of the short-lived QR pairing secret.
- `hasDeviceIdentity(keyId)` supports fail-closed credential checks.
- `deleteDeviceIdentity(keyId)` performs idempotent single-key removal.
- `deleteAllDeviceIdentities()` performs an idempotent namespace wipe.

## Security boundaries

- No key material is written to AsyncStorage, SecureStore JSON, analytics, Sentry, or logs.
- There is no silent key regeneration. A missing key invalidates that computer credential and requires pairing again.
- This design does not claim Secure Enclave storage. Apple documents Keychain generic-password storage for CryptoKit keys without a `SecKey` counterpart.
- Android support requires a separate native-keystore phase before Computer Connection can be enabled there.

## References

- [Apple: Curve25519.Signing.PrivateKey](https://developer.apple.com/documentation/cryptokit/curve25519/signing/privatekey)
- [Apple: Storing CryptoKit keys in the Keychain](https://developer.apple.com/documentation/cryptokit/storing-cryptokit-keys-in-the-keychain)
- [Expo: Module API](https://docs.expo.dev/modules/module-api/)
- [RFC 8410](https://www.rfc-editor.org/rfc/rfc8410)
