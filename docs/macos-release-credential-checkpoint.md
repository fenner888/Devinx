# macOS release credential checkpoint

Last checked: July 13, 2026

The Connector's automated notarization workflow is ready, but this Mac does not yet hold a **Developer ID Application** identity. Keychain currently exposes an Apple Development identity and an iPhone Distribution identity; neither is valid for distributing a Mac app outside the Mac App Store. The July 13 fail-closed preflight stopped at `DEVINX_CODESIGN_IDENTITY is required` before any signing or upload.

The checkpoint was repeated after the Build 62 design freeze with the repository's pinned Node `24.18.0` runtime.
`security find-identity -p codesigning` still returned no Developer ID Application identity, and
`notarytool` confirmed that the `devinx-notary` Keychain profile does not exist. No signing,
notarization, stapling, upload, or public artifact publication was attempted.

The current private Apple-silicon artifact was rebuilt from release-evidence source `4c5f139` and
passed the full deterministic ad-hoc verification workflow. Its SHA-256 is
`8fffe9b33afcae1d152f63f0cf8fed4c99a3b3864e0619c88fa1c78e7843dd3e`. It remains private-test
material and must not be represented or published as the public Connector.

The native confirmed-uninstall path is now implemented and tested at the IPC/runner boundary: it
stops the listener, deletes the Connector's protected Keychain record, unregisters launch at login,
and asks macOS to move the application to Trash. The artifact verifier also exercises isolated
clean-copy, replacement-install, and temporary app-removal mechanics. A real clean-account click
through and stable-identity replacement remain part of the final Developer ID artifact checkpoint.

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
