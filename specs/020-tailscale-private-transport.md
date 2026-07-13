# 020 — Tailscale as a first-class private transport

Status: implemented, automated-test validated, and physically validated from an iPhone against the real macOS Connector on its Tailscale IPv4 address

## Product decision

Tailscale is the only user-facing private transport for the v1 DevinX Connector. DevinX does not embed a Tailscale SDK, create a tailnet, distribute authentication keys, or manage the user's Tailscale account. The user installs Tailscale normally on the computer and iPhone and joins both to the same tailnet.

Same-Wi-Fi support is intentionally removed from v1 setup and Connector controls. Existing certificate-pinned LAN code may remain temporarily as dormant compatibility infrastructure, but the signed Connector must not select it, advertise it, or fall back to it automatically. Reintroducing another transport requires a new spec and complete physical-device security and recovery validation.

Tailscale replaces only the reachability layer. It does not replace the Desktop Bridge or its application security. Devin CLI ACP is a local subprocess protocol, so the Desktop Bridge remains responsible for translating the bounded mobile protocol to supported ACP operations.

## Authentication decision

DevinX does not adopt a shared server password. A shared bearer secret would weaken per-device revocation, permission separation, and audit identity. Tailscale transport therefore retains:

- short-lived QR pairing bound to the advertised endpoint and transport-security mode;
- explicit approval on the Mac;
- a unique non-exportable signing key for each iPhone;
- a bridge-signed permission receipt;
- WireGuard-protected HTTP restricted to an exact active `100.64.0.0/10` endpoint; and
- signed, expiring, replay-protected requests with server-side permission checks.

## Network behavior

The v1 Connector accepts only an active `100.64.0.0/10` Tailscale IPv4 address. If no such address is available, startup fails closed with a bounded Tailscale recovery message. It never substitutes a LAN, link-local, public, wildcard, or user-entered address.

The listener binds to the exact selected Tailscale interface address rather than `0.0.0.0`. It starts HTTP only on that active `100.64.0.0/10` address; the QR records `tailscale_wireguard` and that canonical HTTP origin. It does not also open the listener on Wi-Fi or another computer interface. Host-header validation, device signatures, replay protection, rate limits, payload limits, and server-side authorization remain active.

The iOS ATS exception is limited to the `100.64.0.0/10` domain entry and permits insecure HTTP loads only for that tailnet range. App validation independently requires a canonical explicit-port HTTP origin in `100.64.0.0/10`; it rejects redirects, cookies, encoded responses, oversized bodies, non-JSON responses, and all other cleartext destinations. Tailscale's WireGuard tunnel supplies network encryption while DevinX pairing and per-request signatures supply application authentication and authorization.

Public IP addresses, public DNS listeners, Cloudflare Tunnel, relay services, automatic port forwarding, and arbitrary user-entered URLs remain out of scope. MagicDNS names can be classified by the mobile credential model for future manual configuration, but the current runner advertises an exact active IPv4 address.

## Mobile experience

Computer Connection presents one clearly labeled Tailscale setup path. The instructions explain that both devices must be on the same tailnet and link to the official iOS setup guide. The Connector and mobile Settings identify the stored connection as `Tailscale` without exposing the endpoint. There is no transport selector or automatic LAN fallback. The full setup screen remains keyboard-safe on small iPhones: focusing **Name this Mac** scrolls the field and pairing controls into the keyboard-adjusted viewport, dragging dismisses the keyboard interactively, and the Done key dismisses it without clearing the name.

No reusable password, Tailscale authentication token, tailnet identity, endpoint, transport mode, TLS fingerprint, bridge key, device key, or raw session identifier is placed in React state or ordinary app storage. The existing Keychain credential continues to hold the private connection details.

Legacy certificate-pinned development credentials remain readable only so a new authenticated QR pairing can migrate the same bridge identity to Tailscale. They are omitted from React summaries and rejected by normal protected-request opening, so they cannot silently keep LAN access active.
