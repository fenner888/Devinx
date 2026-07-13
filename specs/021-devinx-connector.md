# 021 — DevinX Connector distribution and cross-platform boundary

Status: macOS implementation, confirmed protected-state uninstall, and automated packaging/replacement validation complete; physical release checkpoint and Developer ID notarization remain. Windows and Linux are required roadmap targets.

## Product decision

The local-computer feature is delivered as **DevinX Connector**. It is an optional companion for users who want DevinX on iPhone to discover, read, or explicitly steer sessions running through Devin for Terminal on a computer. Cloud-only users never need to install it.

The user-facing action is **Connect this computer**. “Desktop Bridge,” ACP, listener addresses, ports, TLS fingerprints, and service managers are implementation details and must not be prerequisites for normal setup.

On macOS, automatic Devin CLI discovery checks both executable entries inherited through `PATH` and the supported Devin desktop application locations in `/Applications` and the current user's `Applications` directory. A GUI launch must not silently disable session discovery merely because macOS did not inherit the user's interactive-shell `PATH`.

The Connector supervises its ACP subprocess while it remains online. If ACP exits after startup, the authenticated listener stays available and the Connector attempts a bounded restart on a fixed interval. Capability checks fail closed during recovery, and no session request is replayed automatically. A later history or steering request for an existing server-issued session handle may securely re-list and re-load that same session in the replacement ACP process before continuing; the client-supplied message is never retried automatically.

DevinX Connector is not an official Cognition component. It uses the supported Devin CLI ACP surface but owns its installation experience, private listener, QR pairing, device authorization, background lifecycle, and platform packaging.

## Required setup experience

1. The user downloads the signed connector for the computer's operating system.
2. The connector detects Devin for Terminal and an active Tailscale IPv4 address without reading Devin credentials.
3. Tailscale is the only v1 connection path. The connector fails closed when no active `100.64.0.0/10` address exists and never falls back to LAN.
4. On macOS, the bridge binds only to the selected active `100.64.0.0/10` tailnet interface. The connector never binds to a LAN, wildcard, or public interface and reports a bounded health status.
5. The user chooses **Connect iPhone** and sees a large short-lived QR code.
6. DevinX scans the QR and the connector displays the requesting device name and requested permissions locally.
7. The computer owner approves or denies the device. Content access and prompt steering remain separate explicit grants.
8. The connector can run as the signed-in user after login, show status, regenerate a code, list/revoke paired devices, stop, repair, update, and uninstall.

The phone never asks for a server URL, IP address, port, shared password, certificate fingerprint, or Tailscale authentication key. An AI-assisted setup prompt and command-line runner may remain available for technical recovery, but they are not the primary product path.

## Shared architecture

The connector has one platform-neutral TypeScript bridge core and narrow operating-system adapters:

```text
[Platform UI / installer]
          |
   bounded local IPC
          |
[Connector controller]
          |
[Bridge core + ACP adapter]
          |
[Devin for Terminal]
```

Shared code owns:

- strict configuration and IPC schemas;
- active Tailscale-address discovery and selection policy;
- Devin CLI capability negotiation;
- QR offer creation and expiry;
- pairing review, approval, denial, and device permissions;
- Tailscale-bound private networking and signed request authorization;
- authenticated endpoint refresh when an already-paired computer receives a new Tailscale address;
- health state and redacted diagnostics; and
- platform-independent lifecycle states.

Platform adapters own only:

- secure secret storage;
- executable discovery conventions;
- background-service registration;
- native UI integration;
- code signing, packaging, update, and uninstall behavior; and
- operating-system-specific diagnostics.

No platform adapter may weaken bridge authentication, expose HTTP outside an exact active `100.64.0.0/10` Tailscale interface, bind to `0.0.0.0`, persist a QR payload, or substitute a shared bearer password.

For Tailscale, the connector binds an HTTP listener directly to the Mac's exact active `100.64.0.0/10` tailnet interface. It does not depend on Tailscale Serve, which may be disabled by a tailnet administrator, and it never binds that listener to a LAN, public, or wildcard interface. Tailscale WireGuard provides encrypted network transport; DevinX still requires the QR proof, unique device key, signed expiring requests, replay protection, rate limits, and server-side permission checks. The iOS client accepts this mode only for canonical explicit-port HTTP origins in `100.64.0.0/10`, with a correspondingly scoped ATS exception.

Certificate-pinned LAN transport may remain temporarily in the shared implementation only for backward compatibility with development credentials. It is dormant in the v1 product: the signed Connector does not start it, neither UI exposes it, and Tailscale startup never falls back to it. The endpoint and `transportSecurity` value remain cryptographically bound into the QR proof, pairing request, signed receipt, and stored credential. A mode/scheme mismatch fails closed.

When a QR identifies a computer already paired on the iPhone, DevinX may update the stored endpoint only after the persisted bridge identity, transport security mode, and applicable TLS identity match and a signed protected health request succeeds through the candidate endpoint. It reuses the existing device key and permissions; it does not create a second device grant or trust an endpoint based on QR contents alone.

## Platform sequence

### macOS — first supported release

- Keychain-backed bridge identity and device registry.
- Exact Tailscale-interface binding, with no LAN or wildcard listener and no dependency on Tailscale Serve.
- Native signed and notarized connector application.
- Per-user login item; never a root daemon.
- Local QR and approval UI.
- Deliberate signed-DMG replacement updates. v1 does not run a silent network updater.
- Confirmed native uninstall that stops the listener, deletes only DevinX Connector Keychain state,
  unregisters launch at login, and moves the app to Trash.

### Windows — required follow-up

- Same shared bridge protocol and mobile pairing contract.
- Credential Manager/DPAPI-backed secrets.
- Signed per-user application and appropriate background lifecycle.
- Tailscale and Devin CLI discovery validated on supported Windows versions.

### Linux — required follow-up

- Same shared bridge protocol and mobile pairing contract.
- Secret Service-compatible keyring storage; fail closed when secure storage is unavailable.
- User-level systemd service where available, with a documented foreground fallback.
- Signed/checksummed packages for supported distributions.

Windows and Linux implementation may follow macOS validation, but shared interfaces must not encode Darwin-only assumptions.

## Local UI protocol

The native connector owns the bridge child process through inherited pipes. Messages in both directions are newline-delimited JSON parsed through strict Zod schemas with bounded line sizes. The protocol carries only presentation state and explicit commands:

- ready/listening state and transport label;
- a short-lived QR payload for immediate in-memory rendering;
- a sanitized pending-device review;
- regenerate, approve, deny, stop, and health commands; and
- allowlisted error categories with no paths, credentials, prompts, session content, keys, or raw ACP data.

The QR payload may cross only the inherited local IPC pipe and native render path. It must not enter stdout/stderr logs, files, crash reports, analytics, environment variables, command-line arguments, clipboard, browser history, notifications, or persistent application state.

## Security and release gates

- The connector runs as the signed-in user and never requests administrator privileges for normal use.
- Installation never modifies Devin credentials or copies them to the phone.
- Every protected bridge request repeats server-side authentication and authorization.
- All IPC, endpoint, configuration, and ACP inputs are schema validated.
- Unauthorized resources return a generic `404` path.
- Pairing and write endpoints remain rate limited and replay protected.
- Tailscale requests accept HTTP only for canonical explicit-port `100.64.0.0/10` origins and never fall back to LAN or public transport.
- Background startup is opt-in and visible; no silent LaunchAgent, service, or systemd installation.
- Release artifacts require code signing, notarization where applicable, checksums, provenance, a dependency audit, secret scan, authorization matrix, and clean-machine install/update/uninstall tests.
- The public setup prompt references only an official signed release. It must never guess a package, repository, executable path, or download URL.

## Distribution boundary

The connector may live in this repository while its protocol and mobile client evolve together. Public releases should be published as a separately downloadable companion artifact under the DevinX project. Splitting it into a separate repository is optional and must not happen until the shared protocol versioning, release ownership, security reporting, and coordinated mobile compatibility policy are established.
