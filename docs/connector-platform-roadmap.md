# DevinX Connector platform roadmap

Last updated: July 22, 2026

macOS is the first supported Connector release. Windows 11 x64 is now an active release
implementation—not a “coming soon” placeholder—and Linux follows without changing the mobile
protocol or weakening the security boundary. A platform is advertised as a supported download only
after its native adapter, signed package, and physical test matrix pass.

## Shared release contract

All platforms reuse protocol version 2, the TypeScript bridge/security core, strict Zod boundaries, opaque session handles, per-device grants, signed expiring requests, replay protection, rate limits, exact Tailscale-interface binding, minimized ACP output, and generic unauthorized `404` responses.

Platform code may implement only secure storage, executable discovery, lifecycle integration, UI, packaging/signing, updates, diagnostics, and uninstall. It may never introduce shared passwords, wildcard/LAN/public listeners, persisted QR payloads, silent privilege escalation, or a DevinX-operated relay.

## Windows x64 implementation checkpoint

The shared Windows adapter, current-user DPAPI helper, native WinForms control surface,
notification-area lifecycle, pinned-runtime builder, per-user installer/uninstaller, Authenticode
signing hook, and Windows CI verifier are implemented under `bridge/`, `connector/windows/`,
`connector/windows-installer/`, and `scripts/connector/`. Ordinary CI remains explicitly unsigned
and not for release. A protected manual workflow produces a signed verification candidate once a
publisher-controlled Authenticode identity is configured. Windows becomes a supported download
only after that candidate passes the physical matrix in `specs/037-windows-connector.md`.

Remaining public-release gates:

1. Physically verify the exact ACP methods advertised by the installed official Windows Devin CLI.
   Cognition now documents native Windows x64 and arm64 CLI installers plus `devin acp`; runtime
   negotiation remains authoritative for the exact methods available on the test PC.
2. Configure a stable Authenticode code-signing identity, run the protected signed-candidate
   workflow, and publish its checksum and provenance only after the physical matrix passes. Do not
   distribute the unsigned CI artifact.
3. Validate Windows Firewall behavior while binding only to the active `100.64.0.0/10` Tailscale
   interface.
4. Test pairing, denial, expiry, read/send/create permission separation, endpoint refresh,
   revocation, reboot startup, repair, update, and uninstall on a physical supported Windows PC.
5. Add arm64 only after a separate native build and physical matrix pass.

## Linux follow-up

1. Implement Secret Service-compatible keyring storage and fail closed when a secure keyring is unavailable.
2. Discover Devin for Terminal and Tailscale through allowlisted executable paths without shell-profile execution.
3. Provide an explicit user-level systemd service where available and a foreground fallback; never install a root daemon by default.
4. Bind only to the active `100.64.0.0/10` Tailscale interface and document host-firewall requirements.
5. Publish signed/checksummed packages only for explicitly tested distributions and architectures.
6. Test the same protocol/security matrix plus logout, locked-keyring, reboot, package upgrade, repair, and uninstall behavior.

## Compatibility and release gates

Each platform release requires a compatibility matrix naming OS versions, architectures, Connector version, mobile protocol range, Devin CLI capability snapshot, and Tailscale prerequisites. It also requires dependency and secret scans, authorization/IDOR tests, artifact provenance, platform signature verification, clean-account install/update/uninstall tests, and coordinated mobile backward-compatibility evidence.
