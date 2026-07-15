# DevinX Connector

DevinX Connector is the optional computer companion for users who want the DevinX iPhone app to access sessions running through Devin for Terminal. Cloud-only users do not install it.

## Why Tailscale is not enough by itself

Computer mode needs two different layers:

1. **Tailscale supplies the private network route.** It lets the iPhone reach the computer over an encrypted tailnet.
2. **DevinX Connector supplies the trusted local service.** It listens on that private route, communicates with Devin for Terminal, stores its identity and grants in macOS Keychain, authenticates each paired iPhone, and enforces separate read, steering, and session-creation permissions.

Tailscale does not start or provide that local service. Entering a Tailscale IP, server URL, or password would work only if compatible server software were already installed and running at that address. DevinX uses QR pairing instead of a shared password so each phone has its own cryptographic identity, permissions, and revocation path.

The separate Connector application is the current supported way to install and operate the required local bridge. A future supported desktop client could embed the same bridge, but local-computer access would still require that bridge function. Cloud-only users bypass this architecture and need neither Tailscale nor Connector.

## User experience

1. Download the supported signed connector from the official DevinX release page. Connector 0.1.0 currently supports Apple-silicon Macs; Windows, Linux, and Intel Mac packages are planned but are not available yet.
2. Install and open **DevinX Connector**.
3. Connect the computer and iPhone to the same Tailscale network, then confirm that the connector shows Tailscale and Devin for Terminal.
4. In the iPhone app, open **Settings → Computers → Add Mac/PC → Scan pairing code**.
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

The macOS v1 update path is an explicit signed-DMG replacement: quit DevinX Connector, open the
newer official signed DMG, and replace the existing app in Applications. The stable Developer ID
identity preserves the Connector's Keychain access across legitimate replacements. DevinX does not
silently download or execute Connector updates.

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
npm run connector:notarize:check
npm run connector:build:macos
npm run connector:notarize:macos
```

The builder checksum-verifies the pinned Node.js Foundation archive, then re-signs its runtime with the selected identity and only the JIT entitlement required by this fixed workload. It explicitly rejects `get-task-allow`, dynamic-loader, executable-page-protection, and library-validation exceptions. Public builds sign every DevinX-owned executable from the inside out with the stable Developer ID identity, seal the app with hardened runtime and a secure timestamp, and sign the DMG. Local ad-hoc builds preserve the Keychain helper's compiler identity so rebuilding does not silently invalidate access to existing development pairings. The notarization command fails closed unless the selected identity is a valid Developer ID Application certificate and the named `notarytool` profile works.

The release workflow submits the app ZIP first, requires an accepted response with an issue-free notary log, staples and Gatekeeper-checks the app, rebuilds the DMG around that stapled app, signs and verifies the DMG, submits it separately, staples it, and writes a final checksum plus `notarization-audit.json`. It does not use deprecated `altool` or accept ad-hoc/Apple Development identities.

The app bundle and DMG root both include `LICENSE.txt`, byte-for-byte matching the repository's MIT `LICENSE`. Artifact verification fails closed when either notice is missing or changed.

## Runtime behavior

- The app bundles a pinned Node LTS runtime rather than depending on the user's Node or shell configuration.
- The build downloads the runtime from `nodejs.org` and validates it against the pinned release checksum before packaging.
- Tailscale is the only v1 connection path. On macOS, the connector binds its listener directly to the active `100.x` tailnet interface, so it does not depend on Tailscale Serve being enabled.
- If Tailscale is not connected, the connector fails closed instead of falling back to Wi-Fi or another interface.
- Scanning a new code for the same computer securely refreshes its Tailscale endpoint after an authenticated bridge check; it does not create a duplicate device.
- The listener binds only to the selected active Tailscale IPv4 interface.
- The Devin CLI is discovered from an allowlisted application PATH and launched only through the fixed ACP subcommand.
- Bridge identity, TLS material, and paired-device records stay in macOS Keychain.
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

Windows and Linux must reuse the same bridge and mobile protocol. Their platform adapters supply secure storage, service lifecycle, packaging, signing, and discovery behavior as specified in `specs/021-devinx-connector.md`.
