# Releasing DevinX

This document separates verified release evidence from work that still requires a physical device, Apple credentials, or explicit release approval. Never publish publicly or submit App Review from these instructions without the owner's approval.

## Current checkpoint

- Connector feature baseline: `128269b` (`feat: add secure DevinX Connector steering`); release-audit changes follow it on the same branch
- iOS internal checkpoint: `0.1.0 (13)`
- EAS build: `e0620751-6884-4e9a-867b-355f8e703a77` — finished
- App Store Connect submission: `dcea8f15-013f-47f7-a0a7-92c3b3c05c1c` — finished
- Build 13 is an internal TestFlight checkpoint, not an App Review submission.
- The source checkpoint contains the newest per-computer self-disconnect behavior; confirm the App Store build number containing it before final release testing.

## Release gates

Run the automated gates from a clean checkout:

```bash
npm ci --legacy-peer-deps
npm run ci
npx expo export --platform ios --output-dir /tmp/devinx-production-export
npm audit --json
```

Use the pinned Node version from `.nvmrc` (`20.19.4`). Other odd-numbered or unsupported Node releases can produce dependency engine warnings even when the checks happen to pass.

Record results in `docs/release-readiness.md`. Review every dependency finding instead of applying a breaking `npm audit fix --force`. Before a public release, also complete the authorization matrix, secret scan, dead-code review, privacy-label review, and physical-device checklist.

## Physical iPhone checkpoint

Using the TestFlight build intended for release:

1. Pair through Tailscale with DevinX Connector.
2. On the Mac, grant **Read session content** and **Send messages** only to the test iPhone.
3. Verify Computer-only, Cloud-only, and Cloud + Computer modes.
4. Open a computer session, load bounded history, send a harmless prompt, and verify refreshed history.
5. Confirm the keyboard dismisses after send and the Devin companion starts and stops cleanly.
6. Remove the Mac from the iPhone and verify the Mac device grant is revoked; repeat with Mac-side revoke.
7. Reopen the app after a cold launch and verify revoked credentials cannot be used.

Do not use production credentials or a destructive prompt for this checkpoint.

## macOS Connector distribution

Local development artifacts can be ad-hoc signed, but public distribution requires an Apple **Developer ID Application** certificate and notarization credentials. After those credentials are available:

1. Sign the app and nested executable with hardened runtime.
2. Build the DMG, sign it, and submit it with `notarytool`.
3. Staple the accepted ticket to the app and DMG.
4. Verify with `codesign --verify --deep --strict`, `spctl --assess`, and `stapler validate`.
5. Publish the SHA-256 checksum beside the artifact.

The existing Apple Development certificate is not a substitute for Developer ID distribution signing.

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

## Sentry

Sentry is optional. When `EXPO_PUBLIC_SENTRY_DSN` is absent, initialization is a no-op. When enabled, verify the scrubber with the automated tests and send a synthetic event containing no real credentials or user content.

## Push notifications

Push notifications require a user-operated notifier because the Devin API does not provide background push events. `scripts/notifier/index.mjs` polls sessions and sends Expo notifications. Keep all API keys and push tokens in environment/secrets management; never commit them or place them in client bundles.

## App Store metadata draft

**Name:** DevinX

**Subtitle:** Unofficial mission control for Devin sessions

**Keywords:** Devin,developer,AI,coding,sessions,monitor,cloud,engineering,workflow

**Promotional text:** Monitor, steer, and start Devin Cloud sessions from your phone.

**Description:**

> DevinX is a mobile mission-control client for the Devin API. Monitor active cloud sessions, surface work that needs your input, send follow-up messages, review pull requests and insights, create sessions with repository and attachment context, and track usage from your phone. You can also pair a Mac you control through Tailscale to view and explicitly steer authorized local Devin sessions.
>
> Cloud credentials stay in the device Keychain. Computer credentials remain on the paired devices, and DevinX operates no relay for normal session traffic.
>
> DevinX is an independent, unofficial client for the Devin API. Not affiliated with, endorsed by, or a product of Cognition AI.

**Review notes:**

> This app requires either an existing Devin account with a user-provided credential, a paired DevinX Connector, or both. Credentials are entered or paired at runtime and stored in the iOS Keychain. A test credential and any Connector review steps must be supplied privately in App Store Connect review notes; never commit credentials to the repository.

**Privacy labels draft:**

- User Content: used only for app functionality; sent to the selected Devin API or explicitly paired computer
- Identifiers: organization/account identifiers and a paired-device identifier used for app functionality
- Diagnostics: crash data only when Sentry is configured
- Tracking: no
- Data sale: no

**Required URLs:**

- Support: `https://github.com/fenner888/Devinx/issues`
- Privacy policy: `https://github.com/fenner888/Devinx/blob/main/PRIVACY.md`

The final privacy labels must be checked against the exact production configuration in App Store Connect.

## Intentionally web-only

Ask mode, DeepWiki, model/agent selection, plan/quota bars, and enterprise administration have no supported public API and remain web-only.
