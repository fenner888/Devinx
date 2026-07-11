# Release readiness

Last updated: July 11, 2026

This is the source of truth for the current release checkpoint. A passing internal build is not permission to submit App Review or publish artifacts.

## Verified

- [x] Connector feature baseline `128269b` committed on `devin/phase-4a-connector-foundation`; release-audit changes follow it
- [x] iOS `0.1.0 (14)` EAS build `c6106cba-7fdb-455c-b3ef-d073bf9fda81` finished from commit `f5390b9`
- [x] Build 14 App Store Connect submission `f4f2159a-e5b9-4052-ad17-90d13bec0973` finished with no error as an internal TestFlight checkpoint
- [x] iOS `0.1.0 (17)` was built locally from clean commit `19dd249` after EAS's free remote-build quota rejected Build 15 and the first local-tooling attempt reserved Build 16
- [x] Build 17 IPA signature and bundle metadata passed (`com.fenner888.devinx`, `0.1.0 (17)`); SHA-256 `a494a2f1e91e203080f65403f132a831924e707e8d4ec8194db4acb3bc27d93a`
- [x] Build 17 App Store Connect submission `07b8efa3-b4ae-432a-a0ac-c005d1b344e3` finished with no error as an internal TestFlight checkpoint
- [x] iOS `0.1.0 (20)` was built locally from clean commit `5643f30`; Build 18 stopped only when disposable Xcode storage filled, and 19 was reserved during the clean retry
- [x] Build 20 IPA signature and bundle metadata passed (`com.fenner888.devinx`, `0.1.0 (20)`); SHA-256 `a2f3e692d96715219178393a264fc3f78a9b5c73ebc01f0214cd210e6064a52a`
- [x] Build 20 App Store Connect submission `6c98a795-35f3-4720-8408-182afd6a3cdb` finished with no error as an internal TestFlight checkpoint
- [x] iOS `0.1.0 (21)` was built locally from clean commit `6cc2efc` after removing unused remote-push registration and correcting the release privacy disclosures
- [x] Build 21 IPA signature, bundle metadata, and privacy artifact inspection passed (`com.fenner888.devinx`, `0.1.0 (21)`); no notification framework/bundle remained; SHA-256 `9f19ce5e9596d1bf1cd74adc4e2e05a28a709482b2e19d72e9cdc85165a73f1d`
- [x] Build 21 App Store Connect submission `41696463-d06f-4d64-8a78-f08f432937ed` finished with no error as the consolidated internal TestFlight candidate
- [x] iOS `0.1.0 (22)` was built locally from clean commit `773f348` after the static accessibility audit named every icon-only control
- [x] Build 22 IPA signature, bundle metadata, and privacy artifact inspection passed (`com.fenner888.devinx`, `0.1.0 (22)`); no notification framework/bundle remained; SHA-256 `1711e71b56eb6cb171724c2c49bbfc9ed5146444dff9cad3f7319856de634326`
- [x] Build 22 App Store Connect submission `88a3d12a-367b-432c-84d9-4ffcb786144d` finished with no error as the superseding consolidated internal TestFlight candidate
- [x] iOS `0.1.0 (23)` was built locally from clean commit `8566659` after aligning the public policy and in-app privacy controls with the exact release configuration
- [x] Build 23 IPA signature, bundle metadata, entitlements, and privacy artifact inspection passed (`com.fenner888.devinx`, `0.1.0 (23)`); no notification artifacts or APS entitlement remained; SHA-256 `17b60c9b09836ca5dd57a2f6aec06a3f0f68c8d6661457ec5fc823ff2a97c247`
- [x] Build 23 App Store Connect submission `e451bf7a-02f2-4851-a6c8-7d47101b4df4` finished with no error as the superseding consolidated internal TestFlight candidate
- [x] iOS `0.1.0 (24)` was built locally from clean commit `80c615c`, containing the complete local-data wipe, corrected EAS Update privacy disclosure, App Store-length subtitle, and public-release audit
- [x] Build 24 IPA signature, bundle metadata, entitlements, update channel/runtime, file protection, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (24)`, `NSFileProtectionComplete`); no notification artifacts or APS entitlement remained; SHA-256 `825986a8909ff27b4e118175abc1084bb2556c9a87c0e138ece17d117439cbe5`
- [x] Build 24 App Store Connect submission `355f66a7-e791-4cbb-96d2-8262ca689229` finished with no error as the superseding consolidated internal TestFlight candidate
- [x] iOS `0.1.0 (25)` was built locally from clean commit `296e90a` after removing the dormant crash-reporting SDK, native plugin, build flags, and raw error-detail rendering
- [x] Build 25 IPA signature, metadata, entitlements, production update channel/runtime, file protection, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (25)`, `NSFileProtectionComplete`); 10 privacy manifests contain no collected-data declarations, no reporting/notification artifacts or APS entitlement remain; SHA-256 `33dc35a39cb4943523ea70d00cdc7b285f3db7de7cf39822e629b197fc4dc713`
- [x] Build 25 App Store Connect submission `edb84701-c0ff-4421-a70a-c3913dfd99b1` finished with no error as the definitive consolidated internal TestFlight candidate
- [x] iOS `0.1.0 (27)` was built locally from clean commit `4badef2` after the free EAS iOS quota rejected the remote job; the retry selected Xcode 26.6 and Node 20.19.4 only for the build process
- [x] Build 27 IPA signature, metadata, entitlements, production update channel/runtime, file protection, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (27)`, `NSFileProtectionComplete`); 10 privacy manifests and no notification/reporting artifacts remain; SHA-256 `3ef271fef8b4d0fd1059572110bbe4a3719b00d01d158454da3aeee6fb279c73`
- [x] Build 27 App Store Connect submission `59a13e8c-d291-4f65-a588-a0ec04129c33` finished with no error and is processing as the local-session creation/model-control TestFlight checkpoint
- [x] Secure Tailscale pairing succeeded on a physical iPhone and Mac
- [x] Build 14 physically discovered eight Mac sessions and loaded a real session with steering authorized
- [x] A harmless Build 14 prompt reached the desktop session, returned the exact requested Devin reply, and dismissed the keyboard
- [x] Same-Wi-Fi setup removed from the v1 product path
- [x] Per-device read and send permissions enforced server-side
- [x] Opaque local session discovery and bounded content loading implemented
- [x] Authorized ACP text prompting and post-send history refresh implemented
- [x] Per-computer removal and requesting-device revocation implemented
- [x] Cloud-only, Computer-only, and combined modes represented in the app model
- [x] Cloud and Computer session creation use separate pickers; local creation uses opaque workspace handles, dynamic model choices, and a separately revocable Mac permission
- [x] Public support and privacy URLs available from the public repository

## Automated gates

The results below must be refreshed after release-document changes and before a release candidate is built.

| Gate | Current result |
|---|---|
| Lockfile install | passed; release environment is pinned to Node 20.19.4 (the local Node 23 shell emitted expected unsupported-engine warnings) |
| Lint | passed, zero warnings |
| TypeScript | passed for app and bridge |
| Jest | passed 52 suites / 400 tests with handle detection enabled; no analytics or crash-reporting SDK runtime is loaded by the test environment |
| Production iOS export | passed after dormant SDK removal; 12 MB total, 5.38 MB Hermes bundle, 101 assets |
| High/critical dependency audit | passed; 0 high, 0 critical |
| Moderate dependency review | 21 transitive advisories after removing unused notifications: `markdown-it` has no fix; PostCSS/UUID fixes require a breaking Expo 57 migration, so no forced upgrade |
| Secret/key scan | passed the tracked-file API-key and secret-variable gates |
| Authorization/IDOR matrix | reviewed in `docs/authorization-matrix.md` |
| App privacy artifact | Build 27 contains 10 privacy manifests and no notification/reporting artifact; no APS entitlement is present; direct API/partner flows are mapped in `docs/app-privacy-review.md` |
| Accessibility token contrast | passed WCAG AA normal-text checks for primary, secondary, and link text in both themes |
| Accessibility semantics | static TSX audit passed: every icon-only Pressable/Touchable has an explicit accessible name; visible-text controls retain derived labels |
| Static dead-code signal | strict TypeScript passed with `--noUnusedLocals --noUnusedParameters` |
| Connector app build/signature | passed build and strict code-sign verification with ad-hoc development signature |
| Connector DMG/checksum | passed after minimal-runtime-entitlement and Keychain-identity preservation changes; the generated arm64 DMG matches its adjacent `.sha256` file |
| Developer ID/notarization workflow | prepared and fail-closed; checksum-verifies then minimally re-signs Node without debug/dynamic-loader entitlements, rejects development identities, notarizes/staples app before rebuilding and notarizing DMG |

## Required physical checkpoint

- [ ] Install Build 27 and confirm Cloud and Computer expose their distinct pickers
- [ ] Enable `Create new sessions` for the iPhone in Connector and create a harmless Computer session with an approved workspace and selected model
- [ ] Confirm the selected model appears on the new local session and the initial prompt receives a reply
- [ ] Confirm no raw Mac path or raw ACP session identifier appears on the phone
- [x] Confirm the final TestFlight build contains the current self-disconnect, complete local-data wipe, session-boundary, local-history, companion-travel, privacy, accessibility, and dormant-SDK removal changes (Build 25 / `296e90a`)
- [x] Grant content read and message send to the iPhone in Connector
- [x] Discover and load a real desktop session
- [x] Send a harmless message and confirm it reaches that session
- [ ] Confirm bounded history refreshes without exposing unsupported ACP data
- [x] Confirm keyboard dismissal
- [ ] Confirm Devin companion start/stop behavior
- [ ] Remove the computer on iPhone and confirm immediate loss of access
- [ ] Re-pair, revoke on Mac, and confirm the phone loses access
- [ ] Exercise Cloud-only, Computer-only, and Cloud + Computer after cold launch
- [ ] Check light/dark appearance, reduced motion, VoiceOver labels, Dynamic Type, and camera/scanner layout on the physical phone

## External release gates

- [ ] Obtain an Apple Developer ID Application certificate
- [ ] Sign, notarize, staple, and Gatekeeper-verify the macOS Connector and DMG
- [ ] Provide a non-production review credential and Connector review instructions privately in App Store Connect
- [x] Confirm App Privacy answers against the exact production crash-reporting/push configuration
- [x] Review current official Cognition, Expo, and Tailscale privacy/retention materials and record the EAS Update randomized installation token in `docs/app-privacy-review.md`
- [ ] Confirm the selected Devin account/agreement's exact retention treatment and publish the final App Store Connect privacy answers from `docs/app-privacy-review.md`
- [ ] Capture final iPhone screenshots without credentials or private session content
- [x] Review the production dependency lock, secret scan, dead code, and authorization matrix
- [ ] Receive explicit approval before App Review submission or public artifact publication

## Platform scope

macOS is the first Connector release. Windows and Linux follow with the same protocol and authorization contract, but require platform-native credential storage, process supervision, packaging/signing, firewall guidance, Tailscale discovery, and update strategy. Their absence does not delay the macOS-first internal validation, and neither platform should be advertised as supported until its own threat model and physical tests pass.
