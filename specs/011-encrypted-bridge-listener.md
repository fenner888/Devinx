# 011 — Encrypted Desktop Bridge listener

Status: implemented transport and bridge-side pairing routes; mobile pinning pending

## Gate decisions

- The bridge uses a separate self-signed TLS certificate for transport and its existing Ed25519 identity for protocol receipts and request trust. The QR will carry both SHA-256 fingerprints. The phone must pin both before sending pairing data.
- TLS private material will be generated only during explicit bridge setup and stored in the macOS Keychain. The certificate is not installed into the system trust store.
- Initial discovery is the QR's explicit host and port. Bonjour and arbitrary manual discovery remain disabled until the pinned flow passes real-device testing.
- Session titles remain hidden without `session:content:read`; paths are never returned.
- Local mobile session content is not cached in the first release.
- Devin CLI is discovered as a user-installed executable and is not bundled.
- ACP capabilities are negotiated at every launch because observed capabilities can differ without a marketing-version change.
- The first remote surface is private LAN only. Public tunnels and relays remain deferred; Tailscale is a later explicit compatibility phase.

These decisions close the listener prerequisites in `002-local-bridge-threat-model.md` and `005-local-bridge-pairing.md` for the transport core. They do not authorize public binding, certificate installation, background launch, or a relay.

## Listener contract

- HTTPS with TLS 1.3 is the only listener. There is no HTTP downgrade path.
- Construction does not open a socket. `start()` is an explicit lifecycle action.
- Default bind is `127.0.0.1`. A non-loopback bind requires `allowLan: true`, TLS material, and explicit allowed Host values.
- LAN mode accepts only loopback, RFC 1918, link-local, IPv6 ULA/link-local, and carrier-grade NAT peers. Public source addresses are rejected before parsing.
- The listener does not trust forwarding headers and derives a privacy-safe peer key from the actual TLS socket address.
- The protected route is `POST /v1/request`. Authentication and authorization remain the signed-envelope responsibility of `BridgeService` on every call. Narrow submit/status pairing routes use the QR HMAC and one-time poll token described in `012-tls-pairing-transport.md`; desktop approval is never network-exposed.
- Browser-origin headers, cookies, ambient Authorization credentials, proxy credentials, WebSocket upgrades, and `Expect` flows are rejected.
- Exactly one Host header must match an explicit allowed host and the bound port. This blocks Host confusion and DNS-rebinding routes.
- JSON must be UTF-8 `application/json`, uncompressed, non-chunked, and have an exact positive Content-Length.
- Headers, bodies, connection count, global/per-peer concurrency, request rate, handshake time, header time, body time, idle time, and requests per socket are bounded before dispatch.
- Request buffers are not logged and are overwritten after parsing where JavaScript memory semantics permit. Prompts, signed bodies, paths, keys, and raw ACP payloads remain excluded from logs.
- Responses disable caching and browser content interpretation. Authentication and authorization denials remain generic 404 responses from the service.

## Pending integration

- Implement an iOS native pinned HTTPS client that accepts only the exact QR fingerprint; normal React Native networking must not bypass pinning.
- Exercise pairing expiry, replay, Host/Origin, oversized/slow body, concurrency, revocation, wrong-certificate, and wrong-bridge cases end to end on a real Mac and iPhone.
