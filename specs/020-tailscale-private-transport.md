# 020 — Tailscale as a first-class private transport

Status: implemented and synthetically validated; real Mac/iPhone transport test pending

## Product decision

Tailscale is the recommended path for reaching a user's Desktop Bridge away from the Mac's local Wi-Fi. Same-Wi-Fi access remains available. DevinX does not embed a Tailscale SDK, create a tailnet, distribute authentication keys, or manage the user's Tailscale account. The user installs Tailscale normally on the Mac and iPhone and joins both to the same tailnet.

Tailscale replaces only the reachability layer. It does not replace the Desktop Bridge or its application security. Devin CLI ACP is a local subprocess protocol, so the Desktop Bridge remains responsible for translating the bounded mobile protocol to supported ACP operations.

## Authentication decision

DevinX does not adopt a shared server password. A shared bearer secret would weaken per-device revocation, permission separation, and audit identity. Tailscale transport therefore retains:

- short-lived QR pairing bound to the advertised endpoint and TLS certificate;
- explicit approval on the Mac;
- a unique non-exportable signing key for each iPhone;
- a bridge-signed permission receipt;
- certificate-pinned HTTPS; and
- signed, expiring, replay-protected requests with server-side permission checks.

## Network behavior

The development runner accepts only a private, link-local, or `100.64.0.0/10` IPv4 address that is currently active on the Mac. A `100.64.0.0/10` address is labeled `Tailscale/VPN`; other accepted private addresses are labeled `Same Wi-Fi`.

The HTTPS listener binds to the exact selected interface address rather than `0.0.0.0`. The QR advertises only that same canonical HTTPS origin. Selecting a Tailscale address therefore does not also open the listener on Wi-Fi or another Mac interface. Host-header validation, pinned TLS, device authentication, rate limits, payload limits, and authorization remain active on both transport kinds.

Public IP addresses, public DNS listeners, Cloudflare Tunnel, relay services, automatic port forwarding, and arbitrary user-entered URLs remain out of scope. MagicDNS names can be classified by the mobile credential model for future manual configuration, but the current runner advertises an exact active IPv4 address.

## Mobile experience

Computer Connection defaults to a clearly labeled Tailscale setup path and also offers Same Wi-Fi. The Tailscale instructions explain that both devices must be on the same tailnet and link to the official iOS setup guide. The session header and Settings identify the stored connection as `Tailscale/VPN` or `Same Wi-Fi` without exposing the endpoint.

No reusable password, Tailscale authentication token, tailnet identity, endpoint, TLS fingerprint, bridge key, device key, or raw session identifier is placed in React state or ordinary app storage. The existing Keychain credential continues to hold the private connection details.
