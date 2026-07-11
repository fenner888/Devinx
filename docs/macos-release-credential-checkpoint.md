# macOS release credential checkpoint

Last checked: July 11, 2026

The Connector's automated notarization workflow is ready, but this Mac does not yet hold a **Developer ID Application** identity. Keychain currently exposes an Apple Development identity and an iPhone Distribution identity; neither is valid for distributing a Mac app outside the Mac App Store. The fail-closed preflight correctly stops before any signing or upload.

Apple requires a Developer ID Application certificate, hardened runtime, secure timestamp, valid signatures, and notarization for directly distributed modern macOS software. See Apple's [Developer ID certificate instructions](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/) and [notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Account-holder action

1. As the Apple Developer Program Account Holder, create a **Developer ID Application** certificate in Certificates, Identifiers & Profiles or Xcode.
2. Install the resulting certificate and its matching private key in the login Keychain on this build Mac.
3. Store notarization credentials interactively; do not paste a password, API private key, or token into chat or source control:

   ```bash
   xcrun notarytool store-credentials devinx-notary
   ```

4. Confirm only the non-secret identity display name and Keychain profile name when ready.

## Automated continuation

After the identity exists, run:

```bash
export DEVINX_CODESIGN_IDENTITY='Developer ID Application: Mark Fenner (TEAMID)'
export DEVINX_NOTARYTOOL_PROFILE='devinx-notary'
npm run connector:notarize:check
npm run connector:build:macos
npm run connector:notarize:macos
```

The workflow signs inside-out, rejects debug/dynamic-loader entitlements, submits and reviews the app and DMG separately with `notarytool`, staples both tickets, runs Gatekeeper assessments, and emits a final checksum and notarization audit. The artifact must then pass install, login-start, repair, update, and uninstall checks in a clean macOS account before publication.
