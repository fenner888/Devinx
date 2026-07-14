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
- SHA-256: `8bd5e31d54ae607ac6302fc544c8e8392c46c20532ab3cd000ca3e9c4c682634`
- App submission: `be66c7b7-291b-4e64-859a-9da71e234bed` (`Accepted`)
- DMG submission: `092ebeb4-6235-4891-b8bf-1f7d7112201b` (`Accepted`)

The artifact is release-eligible from a signing and notarization perspective, but it has not been
published. Public publication still requires an explicit owner decision after the clean-account
install, login-start, repair, update, and uninstall checks below.

The native confirmed-uninstall path is now implemented and tested at the IPC/runner boundary: it
stops the listener, deletes the Connector's protected Keychain record, unregisters launch at login,
and asks macOS to move the application to Trash. The artifact verifier also exercises isolated
clean-copy, replacement-install, and temporary app-removal mechanics. A real clean-account click
through and stable-identity replacement remain part of the final Developer ID artifact checkpoint.

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
