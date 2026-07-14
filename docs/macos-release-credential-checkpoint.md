# macOS release credential checkpoint

Last checked: July 14, 2026

The Connector's public-distribution credential and notarization checkpoint is complete on this build
Mac. The login Keychain contains the valid **Developer ID Application: Mark Fenner
(Q7H78WYTAR)** identity and the validated `devinx-notary` notarytool profile. The one-time App Store
Connect API private-key download used to create the Keychain profile was deleted from Downloads after
credential validation; no private key is stored in source control or release evidence.

The release workflow ran with the repository's pinned Node `24.18.0` runtime. The app and DMG were
signed with hardened runtime, submitted separately to Apple, accepted, stapled, and accepted by
Gatekeeper as `Notarized Developer ID`. The final Apple-silicon DMG is:

- Artifact: `artifacts/connector/DevinX-Connector-0.1.0-macos-arm64.dmg`
- Source commit: `106f163d53662c5a5b9a5df6d787f208e21a2217`
- SHA-256: `659142d305644b42f1c29302faea0ebeded1dbb0085a09bb0512d1ce51710d73`
- App submission: `dd101f69-fa3d-4d73-8a36-d3174b950f1b` (`Accepted`)
- DMG submission: `a2070925-e2c4-411b-9c96-6c37357071af` (`Accepted`)
- Public release: <https://github.com/fenner888/Devinx/releases/tag/connector-v0.1.0>

The owner explicitly approved public Connector publication. The annotated `connector-v0.1.0` tag
resolves to the source commit above, the public checksum verifies the downloaded DMG, Apple staple
validation passes, Gatekeeper accepts it as `Notarized Developer ID`, and `/releases/latest` resolves
to this release.

The native confirmed-uninstall path is implemented and tested at the IPC/runner boundary: it
stops the listener, deletes the Connector's protected Keychain record, unregisters launch at login,
and asks macOS to move the application to Trash. A protected-state-wiped non-admin lifecycle test on
the current account covered install, first launch, Tailscale/Devin detection, Keychain initialization,
replacement, and confirmed uninstall. The artifact verifier also exercises isolated clean-copy,
replacement-install, and temporary app-removal mechanics. A separate fresh-account exercise remains
a documented hardening follow-up and is not represented as completed evidence.

Apple requires a Developer ID Application certificate, hardened runtime, secure timestamp, valid signatures, and notarization for directly distributed modern macOS software. See Apple's [Developer ID certificate instructions](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/) and [notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Account-holder action

No additional signing credential action is required on this build Mac. Do not export the Developer ID
private key, copy the `devinx-notary` credential out of Keychain, or commit Apple credential material.

## Automated continuation

For an intentional rebuild on this authorized Mac, run:

```bash
export DEVINX_CODESIGN_IDENTITY='Developer ID Application: Mark Fenner (TEAMID)'
export DEVINX_NOTARYTOOL_PROFILE='devinx-notary'
npm run connector:notarize:check
npm run connector:build:macos
npm run connector:notarize:macos
```

The workflow signs inside-out, rejects debug/dynamic-loader entitlements, submits and reviews the app
and DMG separately with `notarytool`, staples both tickets, runs Gatekeeper assessments, and emits a
final checksum and notarization audit. The July 14 artifact passed those automated checks. It must
still pass install, login-start, repair, update, and uninstall checks in a clean macOS account before
publication.
