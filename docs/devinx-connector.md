# DevinX Connector

DevinX Connector is the optional local companion for users who want the DevinX iPhone app to access supported sessions on a computer they control. Cloud-only users do not install it.

## Why Tailscale is not enough by itself

Local mode needs two different layers:

1. **Tailscale supplies the private network route.** It lets the iPhone reach the computer over an encrypted tailnet.
2. **DevinX Connector supplies the trusted local service.** It listens on that private route, communicates with a supported local Devin ACP capability, stores its identity and grants in platform-protected storage, authenticates each paired iPhone, and enforces separate read, steering, and session-creation permissions.

Tailscale does not start or provide that local service. Entering a Tailscale IP, server URL, or password would work only if compatible server software were already installed and running at that address. DevinX uses QR pairing instead of a shared password so each phone has its own cryptographic identity, permissions, and revocation path.

The separate Connector application is the current supported way to install and operate the required local bridge. A future supported desktop client could embed the same bridge, but local-computer access would still require that bridge function. Cloud-only users bypass this architecture and need neither Tailscale nor Connector.

## User experience

1. Choose the trusted package for the computer:
   - Apple-silicon macOS: download the signed DMG and checksum from the
     [official DevinX release page](https://github.com/fenner888/Devinx/releases/latest).
   - Windows 11 x64: install only
     [DevinX Connector from Microsoft Store](https://apps.microsoft.com/detail/9N52Z3FVMFH8)
     after the listing is public. The package must be published by **DevinX Tools** with Store ID
     `9N52Z3FVMFH8`.
   Linux and Intel Mac packages remain unavailable.
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

On a Windows 11 x64 development machine with Node 24, .NET 10, and the Windows 11 SDK installed:

```powershell
npm ci --legacy-peer-deps
npm run connector:build:windows:store
npm run connector:verify:windows
npm run connector:verify:windows:store
```

The build compiles a native per-user Windows control surface, a current-user DPAPI helper, and a
self-contained per-user installer/uninstaller. It bundles the pinned Node runtime only after
validating the Node.js Foundation checksum and creates a ZIP, installer EXE, and adjacent checksums
under `artifacts/connector/windows/`. The verifier rejects missing files, source maps, debug
symbols, runtime-version drift, checksum drift, and an invalid MIT license; it executes bounded
DPAPI set/get/delete checks and performs an install/registration/uninstall lifecycle.
The signed native helper also creates the Connector's bounded self-signed TLS identity in memory
with .NET cryptography. Windows does not need OpenSSL, and the resulting identity is retained only
inside the current user's DPAPI-protected Connector state.

Ordinary CI uploads two deliberately separate artifacts:

- an EXE/ZIP verification artifact explicitly named **UNSIGNED-NOT-FOR-RELEASE**; and
- an unsigned MSIX explicitly named **MICROSOFT-STORE-UPLOAD** whose manifest uses the exact
  Partner Center identity.

The MSIX is uploaded only to Partner Center. Microsoft signs the accepted Store package; the
unsigned upload MSIX must never be sideloaded or offered as a direct download. The identity is:

- package identity: `DevinXTools.DevinXConnector`
- publisher: `CN=43D84E24-857C-4C40-9DAA-1A6983913CD9`
- publisher display name: `DevinX Tools`
- Store ID: `9N52Z3FVMFH8`
- package family: `DevinXTools.DevinXConnector_ydtgrt4yd5wrc`

The Store package declares an opt-in Windows startup task. Connector uses the packaged
`Windows.ApplicationModel.StartupTask` API and respects a task disabled by the user in Windows
Settings or Task Manager. A separately distributed direct-download installer remains a distinct
future gate and would require Authenticode signing for every owned executable and installer.

Public distribution still requires clean-account install/update/uninstall, Store signature
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
- Launch at login is an explicit user toggle. macOS uses the per-user login-item API; the Windows
  Store package uses its manifest-declared startup task and Windows' packaged startup API.

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
