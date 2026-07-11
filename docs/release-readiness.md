# Release readiness

Last updated: July 10, 2026

This is the source of truth for the current release checkpoint. A passing internal build is not permission to submit App Review or publish artifacts.

## Verified

- [x] Connector feature baseline `128269b` committed on `devin/phase-4a-connector-foundation`; release-audit changes follow it
- [x] iOS `0.1.0 (14)` EAS build `c6106cba-7fdb-455c-b3ef-d073bf9fda81` finished from commit `f5390b9`
- [x] Build 14 App Store Connect submission `f4f2159a-e5b9-4052-ad17-90d13bec0973` finished with no error as an internal TestFlight checkpoint
- [x] Secure Tailscale pairing succeeded on a physical iPhone and Mac
- [x] Same-Wi-Fi setup removed from the v1 product path
- [x] Per-device read and send permissions enforced server-side
- [x] Opaque local session discovery and bounded content loading implemented
- [x] Authorized ACP text prompting and post-send history refresh implemented
- [x] Per-computer removal and requesting-device revocation implemented
- [x] Cloud-only, Computer-only, and combined modes represented in the app model
- [x] Public support and privacy URLs available from the public repository

## Automated gates

The results below must be refreshed after release-document changes and before a release candidate is built.

| Gate | Current result |
|---|---|
| Lockfile install | passed; release environment is pinned to Node 20.19.4 (the local Node 23 shell emitted expected unsupported-engine warnings) |
| Lint | passed, zero warnings |
| TypeScript | passed for app and bridge |
| Jest | passed 47 suites / 366 tests with handle detection enabled; Sentry's import-time timers are isolated by the test setup |
| Production iOS export | passed; 13 MB total, 6.96 MB Hermes bundle, 101 assets |
| High/critical dependency audit | passed; 0 high, 0 critical |
| Moderate dependency review | 22 transitive advisories: `markdown-it` has no fix; PostCSS/UUID fixes require a breaking Expo 57 migration, so no forced upgrade |
| Secret/key scan | passed the tracked-file API-key and secret-variable gates |
| Authorization/IDOR matrix | reviewed in `docs/authorization-matrix.md` |
| Accessibility token contrast | passed WCAG AA normal-text checks for primary, secondary, and link text in both themes |
| Static dead-code signal | strict TypeScript passed with `--noUnusedLocals --noUnusedParameters` |
| Connector app build/signature | passed build and strict code-sign verification with ad-hoc development signature |
| Connector DMG/checksum | passed after minimal-runtime-entitlement and Keychain-identity preservation changes; the generated arm64 DMG matches its adjacent `.sha256` file |
| Developer ID/notarization workflow | prepared and fail-closed; checksum-verifies then minimally re-signs Node without debug/dynamic-loader entitlements, rejects development identities, notarizes/staples app before rebuilding and notarizing DMG |

## Required physical checkpoint

- [x] Confirm the intended TestFlight build contains the current self-disconnect source change (Build 14 / `f5390b9`)
- [ ] Grant content read and message send to the iPhone in Connector
- [ ] Discover and load a real desktop session
- [ ] Send a harmless message and confirm it reaches that session
- [ ] Confirm bounded history refreshes without exposing unsupported ACP data
- [ ] Confirm keyboard dismissal and Devin companion start/stop behavior
- [ ] Remove the computer on iPhone and confirm immediate loss of access
- [ ] Re-pair, revoke on Mac, and confirm the phone loses access
- [ ] Exercise Cloud-only, Computer-only, and Cloud + Computer after cold launch
- [ ] Check light/dark appearance, reduced motion, VoiceOver labels, Dynamic Type, and camera/scanner layout on the physical phone

## External release gates

- [ ] Obtain an Apple Developer ID Application certificate
- [ ] Sign, notarize, staple, and Gatekeeper-verify the macOS Connector and DMG
- [ ] Provide a non-production review credential and Connector review instructions privately in App Store Connect
- [ ] Confirm App Privacy answers against the exact production Sentry/push configuration
- [ ] Capture final iPhone screenshots without credentials or private session content
- [ ] Review the production dependency lock, secret scan, dead code, and authorization matrix
- [ ] Receive explicit approval before App Review submission or public artifact publication

## Platform scope

macOS is the first Connector release. Windows and Linux follow with the same protocol and authorization contract, but require platform-native credential storage, process supervision, packaging/signing, firewall guidance, Tailscale discovery, and update strategy. Their absence does not delay the macOS-first internal validation, and neither platform should be advertised as supported until its own threat model and physical tests pass.
