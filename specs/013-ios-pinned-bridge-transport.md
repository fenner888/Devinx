# 013 — iOS pinned Desktop Bridge transport

Status: compatibility implementation complete; spec 020 supersedes this pinned-TLS setup path with Tailscale-only v1 transport. Scanner and Tailscale pairing passed physical validation.

## Native-only trust boundary

Desktop Bridge requests do not use React Native `fetch`. The local `DevinXDeviceCrypto` Expo module creates a new ephemeral `URLSession` for each request and accepts the self-signed server certificate only when the leaf certificate DER SHA-256 digest exactly matches the QR or stored credential fingerprint.

The native boundary permits only:

- canonical HTTPS origins with an explicit port and an IPv4 or IPv6 loopback, private, link-local, ULA, or carrier-grade NAT literal;
- `/v1/pair/submit`, `/v1/pair/status`, and `/v1/request`;
- JSON object request and response bodies up to 256 KiB; and
- the bridge protocol's explicit HTTP status vocabulary.

DNS names, public IP addresses, redirects, cookies, caches, cleartext, credentials in URLs, arbitrary paths, compression, non-JSON responses, oversized bodies, and certificate mismatches fail closed. Requests and responses have bounded timeouts, one connection per session, and no sensitive logging. The dedicated session disables configured HTTP proxies and custom `URLProtocol` classes, including the Expo development network inspector, so pairing secrets and signed payloads do not enter debugging capture tools.

## Mobile credential gate

Version 2 paired-computer records store the canonical HTTPS endpoint and TLS certificate fingerprint in Secure Store alongside the pinned Ed25519 bridge identity, server grants, device public key, and opaque Keychain signing-key ID. Private device key bytes never enter JavaScript.

Loading or storing a non-empty computer registry now requires:

- the current native pinned transport;
- a validated version 2 record; and
- the corresponding device private signing key to exist in the native Keychain namespace.

A missing key, old binary, malformed record, or missing TLS pin makes the computer connection unavailable and requires secure repair or pairing again. No unsafe migration is possible from a record that lacks a certificate pin.

## Platform configuration

iOS includes a specific Local Network usage description. App Transport Security continues to disallow arbitrary loads; trust for the self-signed bridge certificate is granted only inside the pinning delegate after an exact fingerprint match.

Automated TypeScript tests use a fake native module. The production Swift target is built for a generic physical iOS device with code signing disabled. Real Mac/iPhone certificate-match, wrong-certificate, local-network permission, offline, and timeout cases remain required before release.
