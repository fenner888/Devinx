# Releasing Otterin and Otterin Connector

This document separates verified release evidence from work that still requires a physical device, Apple credentials, or explicit release approval. Never publish publicly or submit App Review from these instructions without the owner's approval.

## Current checkpoint

- Current iOS internal release candidate: `0.1.0 (55)` from clean commit `4825409`
- Build 55 IPA SHA-256: `f41f3c931aaeb32e21f472d7040ca26abe3c9f4599fd6b13f8d7f422c152bfde`
- EAS internal-TestFlight submission: `be1a1dc4-c74b-47f4-b0f7-14e857842e23` — finished successfully at 1:12 PM EDT; Apple processing is complete and Build 55 is `Testing` in the internal **Team (Expo)** group
- Build 55 contains the supported capability-boundary work from `c1f5edc` plus the refreshed release evidence in `4825409`.
- Build 55 is an internal TestFlight checkpoint, not an App Review submission.
- The complete historical artifact ledger and remaining physical/external gates are maintained in `docs/release-readiness.md` and `docs/internal-rc-audit-2026-07-13.md`.

## Release gates

Run the automated gates from a clean checkout:

```bash
npm ci --legacy-peer-deps
npm run ci
npx expo export --platform ios --output-dir /tmp/devinx-production-export
npm audit --json
```

Use the pinned Node version from `.nvmrc` (`24.18.0`). It matches the checksum-verified runtime packaged with Otterin Connector and supports the built-in read-only SQLite API used for local history. Other odd-numbered or unsupported Node releases can produce dependency engine warnings even when the checks happen to pass.

Record results in `docs/release-readiness.md`. Review every dependency finding instead of applying a breaking `npm audit fix --force`. Before a public release, also complete the authorization matrix, secret scan, dead-code review, privacy-label review, and physical-device checklist.

## Physical iPhone checkpoint

Using the TestFlight build intended for release:

1. Pair through Tailscale with Otterin Connector.
2. On the Mac, grant **Read session content** and **Send messages** only to the test iPhone.
3. Verify Local Home workspaces/models, Local session history, and single- and multi-Mac pairing.
4. Open a computer session, load bounded history, send a harmless prompt, and verify refreshed history.
5. Confirm the keyboard dismisses after send and the Devin companion starts and stops cleanly.
6. Remove the Mac from the iPhone and verify the Mac device grant is revoked; repeat with Mac-side revoke.
7. Reopen the app after a cold launch and verify revoked credentials cannot be used.

Do not use production credentials or a destructive prompt for this checkpoint.

## macOS Connector distribution

Connector 0.1.18 artifacts are `Otterin Connector.app` and
`Otterin-Connector-0.1.18-macos-${architecture}.dmg`.

The July 14, 2026 Apple-silicon Connector candidate is signed with **Developer ID Application: Mark
Fenner (Q7H78WYTAR)**, accepted by Apple's notarization service, stapled, and accepted by Gatekeeper.
Its DMG SHA-256 is
`8bd5e31d54ae607ac6302fc544c8e8392c46c20532ab3cd000ca3e9c4c682634`. The artifact has not been
published. Exact submission evidence is recorded in `docs/macos-release-credential-checkpoint.md` and
the generated private release audit under `artifacts/connector/`.

For a deliberate rebuild on the authorized build Mac:

1. Store notarization credentials in Keychain with `xcrun notarytool store-credentials devinx-notary`.
2. Set `DEVINX_CODESIGN_IDENTITY` to the exact Developer ID Application identity and `DEVINX_NOTARYTOOL_PROFILE` to the Keychain profile name. If the profile is stored outside the default login Keychain, set `DEVINX_NOTARYTOOL_KEYCHAIN` to that Keychain file path.
3. Run `npm run connector:notarize:check`, then `npm run connector:build:macos`.
4. Run `npm run connector:notarize:macos` to notarize/staple the app first, rebuild and sign the DMG, notarize/staple the DMG, run Gatekeeper checks, and write the checksum/audit record.
5. Test the resulting artifact on a clean macOS account before publication.

The remaining Connector release gate is the clean-account installation, login-start, repair, update,
and uninstall workflow. Public artifact publication still requires separate explicit approval.

## EAS builds

The EAS project and OTA URL are already configured in `app.json`; do not run `eas init` again.

```bash
eas build --profile development --platform ios
eas build --profile development-simulator --platform ios
eas build --profile preview --platform ios
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Building is authorized as part of development. App Review submission and public release require explicit approval.

## Crash reporting

No crash-reporting SDK or destination is bundled in the current release. Adding one requires a new specification, dependency review, transcript/session-content scrubber review, privacy-manifest inspection, and updated App Store privacy answers before another release candidate is built.

## Push notifications

Push notifications are not implemented in v1. The app does not request notification permission, register an Expo push token, or ship a notifier service. Any Phase-2 notifier requires its own reviewed specification, server-side authorization and validation, least-privilege credentials, revocation and retention controls, dependency review, privacy disclosures, and App Store label update before implementation.

## App Store metadata draft

**Name:** Otterin

**Subtitle:** Local coding sessions, mobile

**Keywords:** Devin,developer,AI,coding,sessions,local,Mac,voice,engineering

**Promotional text:** Start, follow and steer Devin for Terminal sessions on your Mac from your iPhone.

**Description:**

> Start and steer local Devin for Terminal sessions from your iPhone. Pair with Otterin Connector on your Mac over Tailscale to review approved session history, follow live updates, send prompts, and answer approvals and questions. Speak detailed prompts with on-device voice.
>
> Your Devin sign-in stays on your Mac. Otterin keeps only its pairing key in iOS Keychain and sends approved session requests directly to your paired Mac.
>
> Otterin is an independent, unofficial companion app for Devin for Terminal. Not affiliated with, endorsed by, or a product of Cognition AI.

**Review notes:**

> This app requires a Mac running Devin for Terminal and Otterin Connector. Pair the review iPhone by scanning a short-lived QR code and approving it in Connector on the Mac. Connector permissions are granted by the reviewer on the Mac. No Devin sign-in credential is entered or stored in Otterin.

**Privacy labels draft:**

- User Content: used only for app functionality; sent only to the explicitly paired Mac when approved
- Identifiers: the Expo EAS Update installation token used for app functionality
- Diagnostics: none collected by Otterin in the current release
- Tracking: no
- Data sale: no

**Required URLs:**

- Support: `https://github.com/fenner888/Otterin/issues`
- Privacy policy: `https://github.com/fenner888/Otterin/blob/main/PRIVACY.md`

The final privacy labels must be checked against the exact production configuration in App Store Connect.

## Intentionally web-owned or deferred

Cloud sessions, Cloud authentication, integrations, repository management, usage and billing, and other Cloud controls are outside Otterin; Devin's official app covers Cloud workflows. Otterin is limited to sessions on a Mac explicitly paired through Otterin Connector.
