# DevinX Connector

DevinX Connector is the optional local companion for users who want the DevinX iPhone app to access supported sessions on a computer they control. Cloud-only users do not install it.

## Why Tailscale is not enough by itself

Local mode needs two different layers:

1. **Tailscale supplies the private network route.** It lets the iPhone reach the computer over an encrypted tailnet.
2. **DevinX Connector supplies the trusted local service.** It listens on that private route, communicates with a supported local Devin ACP capability, stores its identity and grants in platform-protected storage, authenticates each paired iPhone, and enforces separate read, steering, and session-creation permissions.

Tailscale does not start or provide that local service. Entering a Tailscale IP, server URL, or password would work only if compatible server software were already installed and running at that address. DevinX uses QR pairing instead of a shared password so each phone has its own cryptographic identity, permissions, and revocation path.

The separate Connector application is the current supported way to install and operate the required local bridge. A future supported desktop client could embed the same bridge, but local-computer access would still require that bridge function. Cloud-only users bypass this architecture and need neither Tailscale nor Connector.

## User experience

1. Download the supported signed connector from the official DevinX release page. Connector 0.1.2 currently supports Apple-silicon Macs. Windows 11 x64 is an active release implementation; its public download activates only after the signed installer and physical test matrix pass. Linux and Intel Mac packages remain unavailable.
2. Install and open **DevinX Connector**.
3. Connect the computer and iPhone to the same Tailscale network, then confirm that the connector shows Tailscale and Devin for Terminal.
4. In the iPhone app, open **Settings → Local devices → Add local device → Scan pairing code**.
5. Scan the short-lived QR shown by the connector.
6. Confirm the requesting iPhone name and choose its permissions on the computer.

No server URL, IP address, shared password, certificate, port, or Tailscale key is entered into the iPhone app.

## macOS development build

The current macOS-first implementation builds a native application and drag-to-Applications disk image:

```bash
npm run connector:build:macos
```

Generated artifacts are ignored under `artifacts/connector/` so Expo OTA exports cannot delete the desktop bundle:

- `DevinX Connector.app`
- `DevinX-Connector-<version>-macos-<architecture>.dmg`
- the matching `.sha256` file

The local development build is ad-hoc signed. It is suitable for development and real-device validation on the build Mac, but it is not a public release. Public artifacts require a Developer ID signature, hardened runtime verification, notarization, stapling, provenance, and clean-machine Gatekeeper validation.

## Update and uninstall

The macOS v1 update path is an explicit signed-DMG replacement. Connector checks the public
official GitHub release feed and shows **Update available** when it validates a newer release tag
and official release URL. The user still chooses when to open the release page, quit Connector,
open the newer signed DMG, and replace the existing app in Applications. The stable Developer ID
identity preserves Connector's Keychain access across legitimate replacements. DevinX never
silently downloads or executes Connector updates.

The iPhone app also performs an authenticated version handshake with each paired Connector. An old
Connector produces a visible **Connector update required** action that opens only the official
latest-release page; an offline or revoked Connector retains its separate recovery message.

To remove the Connector, choose **Uninstall DevinX Connector** in the native app and confirm. The
Connector stops its private listener before deleting its own Keychain identity and paired-iPhone
permissions, unregisters launch at login, moves itself to Trash, and quits. Reinstalling requires a
fresh QR pairing. If macOS cannot move a read-only or managed app bundle, the app reports that local
state was removed and instructs the user to move the bundle to Trash manually.

## Developer ID release workflow

Store notarization credentials interactively in Keychain; never put an Apple password, private key, or API key in the repository or command history:

```bash
xcrun notarytool store-credentials devinx-notary
```

Then select the exact Developer ID Application identity and the Keychain profile for the release commands:

```bash
export DEVINX_CODESIGN_IDENTITY='Developer ID Application: Your Name (TEAMID)'
export DEVINX_NOTARYTOOL_PROFILE='devinx-notary'
# Only when the profile is stored in a dedicated Keychain:
export DEVINX_NOTARYTOOL_KEYCHAIN='~/Library/Keychains/devinx-build.keychain-db'
npm run connector:notarize:check
npm run connector:build:macos
npm run connector:notarize:macos
```

The builder checksum-verifies the pinned Node.js Foundation archive, then re-signs its runtime with the selected identity and only the JIT entitlement required by this fixed workload. It explicitly rejects `get-task-allow`, dynamic-loader, executable-page-protection, and library-validation exceptions. Public builds sign every DevinX-owned executable from the inside out with the stable Developer ID identity, seal the app with hardened runtime and a secure timestamp, and sign the DMG. Local ad-hoc builds preserve the Keychain helper's compiler identity so rebuilding does not silently invalidate access to existing development pairings. The notarization command fails closed unless the selected identity is a valid Developer ID Application certificate and the named `notarytool` profile works.

The release workflow submits the app ZIP first, requires an accepted response with an issue-free notary log, staples and Gatekeeper-checks the app, rebuilds the DMG around that stapled app, signs and verifies the DMG, submits it separately, staples it, and writes a final checksum plus `notarization-audit.json`. It does not use deprecated `altool` or accept ad-hoc/Apple Development identities.

The app bundle and DMG root both include `LICENSE.txt`, byte-for-byte matching the repository's MIT `LICENSE`. Artifact verification fails closed when either notice is missing or changed.

## Windows 11 x64 active release track

On a Windows 11 x64 development machine with Node 24 and .NET 10 installed:

```powershell
npm ci --legacy-peer-deps
npm run connector:build:windows
npm run connector:verify:windows
```

The build compiles a native per-user Windows control surface, a current-user DPAPI helper, and a
self-contained per-user installer/uninstaller. It bundles the pinned Node runtime only after
validating the Node.js Foundation checksum and creates a ZIP, installer EXE, and adjacent checksums
under `artifacts/connector/windows/`. The verifier rejects missing files, source maps, debug
symbols, runtime-version drift, checksum drift, and an invalid MIT license; it executes bounded
DPAPI set/get/delete checks and performs an install/registration/uninstall lifecycle.

Ordinary CI uploads only an explicitly named **UNSIGNED-NOT-FOR-RELEASE** artifact. The manual
**Windows Connector Signed Candidate** workflow fails closed unless the protected
`windows-connector-release` environment supplies:

- `WINDOWS_SIGNING_PFX_BASE64` and `WINDOWS_SIGNING_PFX_PASSWORD` secrets for the publisher's
  Authenticode identity; and
- a `WINDOWS_TIMESTAMP_URL` variable for an RFC 3161 timestamp service.

Repository administrators must restrict that environment to the protected `main` branch, require a
human reviewer, and prevent self-review where the GitHub plan supports it. The signing identity must
not be exposed to pull-request workflows or ordinary branch builds.

That workflow signs and verifies every DevinX-owned EXE, verifies the signed installer lifecycle,
and uploads a candidate for physical testing. It does not publish a GitHub release. Public
distribution still requires clean-account install/update/uninstall, SmartScreen/signature
inspection, Windows Firewall validation, official Devin ACP validation, and the complete physical
matrix in `specs/037-windows-connector.md`.

## Runtime behavior

- The app bundles a pinned Node LTS runtime rather than depending on the user's Node or shell configuration.
- The build downloads the runtime from `nodejs.org` and validates it against the pinned release checksum before packaging.
- Tailscale is the only v1 connection path. On macOS, the connector binds its listener directly to the active `100.x` tailnet interface, so it does not depend on Tailscale Serve being enabled.
- If Tailscale is not connected, the connector fails closed instead of falling back to Wi-Fi or another interface.
- Scanning a new code for the same computer securely refreshes its Tailscale endpoint after an authenticated bridge check; it does not create a duplicate device.
- The listener binds only to the selected active Tailscale IPv4 interface.
- The Devin CLI is discovered from an allowlisted application PATH and launched only through the fixed ACP subcommand.
- Bridge identity, TLS material, and paired-device records stay in macOS Keychain or Windows current-user DPAPI storage.
- The QR payload crosses only the inherited connector process pipe and the native in-memory renderer.
- Launch at login is an explicit user toggle and uses the per-user macOS login-item API.

## Release gates

Before publishing a macOS connector release:

- retest authorized steering from the final mobile/Connector commits;
- validate QR pairing, denial, expiry, reconnect, and revocation on a physical Mac and iPhone;
- run the authentication and authorization matrices for every protected bridge operation;
- run dependency, secret, dead-code, and packaged-artifact scans;
- run the fail-closed Developer ID signing and two-stage notarization workflow above;
- verify installation, login start, update, repair, and uninstall on a clean macOS account; and
- publish the checksum and compatibility matrix with the artifact.

Windows and Linux must reuse the same bridge and mobile protocol. Their platform adapters supply secure storage, service lifecycle, packaging, signing, and discovery behavior as specified in `specs/021-devinx-connector.md`. Windows implementation and remaining release gates are specified in `specs/037-windows-connector.md`.
