# Release readiness

Last updated: July 12, 2026

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
- [x] iOS `0.1.0 (28)` was built locally from clean commit `fafbbe0` with the compact local-model menu and dismissible unavailable-picker states after the free EAS iOS quota rejected the remote job
- [x] Build 28 IPA signature, metadata, entitlements, production update channel/runtime, file protection, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (28)`, `NSFileProtectionComplete`); 10 privacy manifests and no notification/reporting artifacts remain; SHA-256 `cd4a47ce67a52904dd0723f6feaecaa2b81c0982d1f375f149b2acf50845face`
- [x] Build 28 App Store Connect submission `b84fc761-7198-4f2f-ad57-a07bbbc45adc` finished successfully after retrying Apple's transient upload-container HTTP 500 and is processing as the compact local-model-menu TestFlight checkpoint
- [x] iOS `0.1.0 (29)` was built locally from clean commit `0131a19` after the free EAS iOS quota rejected the remote job; it contains the live ACP catalog grouped into 30 model families with a separate reasoning/speed control that preserves all 143 exact model IDs
- [x] Build 29 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (29)`, `NSFileProtectionComplete`); 10 privacy manifests and no APS entitlement remain; SHA-256 `de28a1103ade24d345ef3233f8d9b344e710ba1f256045644325d7a54277bd44`
- [x] Build 29 App Store Connect submission `e5492fc8-656f-4797-9bcf-5cc096fc69ab` finished successfully and is processing as the live-model-family and reasoning/speed TestFlight checkpoint
- [x] iOS `0.1.0 (30)` was built locally from clean commit `41672d7` after the free EAS iOS quota rejected the remote job; it contains the compact Home prompt area and elevated multiline Cloud and Computer session composers
- [x] Build 30 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (30)`, `NSFileProtectionComplete`); 10 privacy manifests and no APS entitlement remain; SHA-256 `0e445202f7328c3bae20a45d486e06eb056d94ca4290350b047d425f9e50afe4`
- [x] Build 30 App Store Connect submission `bfbf3515-412d-4d5c-bdb9-06c29d090278` finished successfully and is processing as the session-composer layout TestFlight checkpoint
- [x] Build 30 physical review found the Computer session composer structurally incomplete: it was elevated and multiline but omitted the expected model family, reasoning/speed, Mac, and workspace controls
- [x] iOS `0.1.0 (31)` was built locally from clean commit `a69c729` with functional existing-session model family and reasoning/speed controls; the coordinated Connector validates and applies the exact live ACP model ID before direct or continued prompt dispatch
- [x] Build 31 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (31)`, `NSFileProtectionComplete`); 10 privacy manifests and no APS entitlement remain; SHA-256 `7f8e7b7649f18d61302d8487e79b0ec25991b605a5e11b4c6af165ffd5655011`
- [x] Build 31 App Store Connect submission `e5f7f858-bc57-426f-b99f-4216b4b9e74b` finished successfully and is processing as the corrected existing-session composer checkpoint
- [x] iOS `0.1.0 (32)` was built locally from clean commit `a9d34a7` with grouped, content-bounded destination and workspace pickers, flat separator rows, restrained selection states, and explicit dismissal
- [x] Build 32 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (32)`, `NSFileProtectionComplete`); 10 privacy manifests and no APS entitlement remain; SHA-256 `405fcac8041824c24f6c0f0fdbc491fbf2eb8cb625868c32fe766c7ca922f40e`
- [x] Build 32 App Store Connect submission `5c45e07a-71dc-415e-9b75-8f75fb254ddc` finished successfully and is processing as the composer-picker visual checkpoint
- [x] iOS `0.1.0 (33)` was built locally from clean commit `a659d7d` as the UI-freeze checkpoint; the Computer workspace picker now uses an inset floating sheet, explicit Close and Done actions, draft-before-commit selection, sanitized Current/Other sections, and bounded search for long approved lists
- [x] Build 33 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (33)`, `NSFileProtectionComplete`); `get-task-allow=false`, 10 privacy manifests, and no APS entitlement remain; SHA-256 `5fae45aefebb676dcd49ce1b2d2d70d7b5f9b893e08e0037304a0fdf43d3b86c`
- [x] Build 33 App Store Connect submission `ce5d6179-7006-4c08-b9a3-5a75179a49cc` finished successfully and is processing as the final UI-freeze TestFlight checkpoint
- [x] iOS `0.1.0 (34)` was built locally from clean commit `b26d87f` with complete bounded Cloud repository pagination, stable identity deduplication, repeated/missing-cursor rejection, a fail-closed 1,000-repository safety bound, and an explicit retry state instead of a misleading partial picker
- [x] Build 34 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (34)`, `NSFileProtectionComplete`); `get-task-allow=false`, 10 privacy manifests with no tracking/collected-data declarations, and no APS entitlement remain; SHA-256 `b61d5c8c35f117d8a2350872116ca94cb0fffd662dd7490d9fa6d2350e9bd7ec`
- [x] Build 34 App Store Connect submission `fb17c8e7-ae2f-4b46-93b4-0fb66225c8d9` finished successfully and is processing as the consolidated repository-completeness and UI-freeze TestFlight candidate
- [x] iOS `0.1.0 (35)` was built locally from clean commit `e8824a7` after correcting Home Recent to follow the active destination: Cloud now shows only Cloud recents, Computer shows only recents from the selected Mac, and the full Sessions screen remains the combined cross-origin archive
- [x] Build 35 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (35)`, `NSFileProtectionComplete`); `get-task-allow=false`, 10 privacy manifests with no tracking/collected-data declarations, and no APS entitlement remain; SHA-256 `730c84633a5d13c6c8af4156e206cafb2ba0f9322932a8f2b73454dcddf42b85`
- [x] Build 35 App Store Connect submission `8fb4b9d8-c094-4015-8741-5fd08047fc66` finished successfully and is processing as the superseding destination-scoped Recent candidate
- [x] Build 35 physical review passed destination-scoped Home recents, the combined Sessions archive, Cloud/Computer picker separation, repository/workspace/model controls, local session creation, and the compact/elevated composer layouts; the only requested follow-up was anchoring the session companion immediately above the composer
- [x] iOS `0.1.0 (36)` was built locally from clean commit `27d5a6e` with the Cloud and Computer companion tracks removed from scrollable history and anchored as transparent layout siblings immediately above their composers
- [x] Build 36 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and privacy artifacts passed (`com.fenner888.devinx`, `0.1.0 (36)`, `NSFileProtectionComplete`); `get-task-allow=false`, 10 privacy manifests with zero tracking or collected-data declarations, no APS entitlement, and no reporting/notification artifacts remain; SHA-256 `83f58f4f54a561f781360b5895a2ed0580e590483cf1cf40d9644819fa98f162`
- [x] Build 36 App Store Connect submission `ef0bda9d-ee51-4344-95f6-f5290d98a901` finished successfully and is processing as the final companion-placement candidate
- [x] iOS `0.1.0 (43)` was built locally from clean commit `f9f7778` with the consolidated on-device dictation/Scribe UI, corrected companion activity and placement, passive-status cleanup, and native Security Swarm dashboard
- [x] Build 43 IPA signature, metadata, entitlements, production update channel/runtime, file protection, exempt-encryption declaration, and app privacy artifact passed (`com.fenner888.devinx`, `0.1.0 (43)`, `NSFileProtectionComplete`); `get-task-allow=false`, app tracking is disabled, and the app declares zero collected-data types; SHA-256 `d7940d888ed30c8706801c1a503ae0bf0e9076495ac46b3290d5758bbfb556ed`
- [x] Build 43 App Store Connect submission `0d122464-12c7-486b-9cbc-bd7ca8d0babb` finished successfully and is processing as the consolidated voice, companion, and Security Swarm TestFlight checkpoint
- [x] The updated Connector artifact was strict-signature verified and restarted after Build 29 upload so mobile and Mac use the coordinated protocol checkpoint
- [x] Build 29 creation-options HTTP 503 was traced to an empty optional model marker in one valid historical session; the Connector now ignores that marker for Recent models, preserves minimized history without inventing a model, and returns the real four-workspace/four-recent-model option set
- [x] Connector session ownership handoff now uses advertised ACP `session/close` when available and otherwise immediately recycles only its own ACP child after each settled prompt; the installed Devin CLI does not yet advertise close, so the tested recycle path prevents phone-created sessions from remaining permanently unavailable in Devin Desktop
- [x] Build 29 physically validated alternating ownership: a phone-created session became available in Devin Desktop after its turn settled, while Desktop-open sessions continued through the protected continuation path
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
| Lockfile install | passed on Node 24.18.0, now pinned consistently for development, CI, rollback, and the checksum-verified Connector runtime |
| Lint | passed, zero warnings |
| TypeScript | passed for app and bridge |
| Jest | passed 62 suites / 468 tests with handle detection enabled; no analytics or crash-reporting SDK runtime is loaded by the test environment |
| Production iOS export | Build 43 passed local signed export; 20 MB IPA, 1,747 bundled modules, 100 assets |
| High/critical dependency audit | passed; 0 high, 0 critical |
| Moderate dependency review | 21 transitive advisories after removing unused notifications: `markdown-it` has no fix; PostCSS/UUID fixes require a breaking Expo 57 migration, so no forced upgrade |
| Secret/key scan | passed the tracked-file API-key and secret-variable gates |
| Authorization/IDOR matrix | reviewed in `docs/authorization-matrix.md` |
| App privacy artifact | Build 43 contains 10 privacy manifests; the app manifest declares no tracking and zero collected-data types; no APS entitlement is present; direct API/partner flows are mapped in `docs/app-privacy-review.md` |
| Accessibility token contrast | passed WCAG AA normal-text checks for primary, secondary, and link text in both themes |
| Accessibility semantics | static TSX audit passed: every icon-only Pressable/Touchable has an explicit accessible name; visible-text controls retain derived labels |
| Static dead-code signal | strict TypeScript passed with `--noUnusedLocals --noUnusedParameters` |
| Connector app build/signature | passed build and strict code-sign verification with ad-hoc development signature |
| Connector DMG/checksum | passed after minimal-runtime-entitlement and Keychain-identity preservation changes; the generated arm64 DMG matches its adjacent `.sha256` file |
| Developer ID/notarization workflow | prepared and fail-closed; checksum-verifies then minimally re-signs Node without debug/dynamic-loader entitlements, rejects development identities, notarizes/staples app before rebuilding and notarizing DMG |

## Required physical checkpoint

- [x] In Build 35, switching Home from Cloud to Computer changed Recent from Cloud sessions to sessions from the selected Mac, switching back restored Cloud recents, and View all retained the combined cross-origin Sessions screen
- [x] In Build 35, the destination and workspace sheets remained compact, bounded, explicitly dismissible, and free of raw paths or excessive empty space
- [x] In Build 35, Cloud repositories remained distinct from Computer workspaces and the complete bounded repository picker behaved correctly
- [x] In Build 35, existing Computer sessions exposed the current model family, reasoning/speed, Mac, and workspace controls
- [x] In Build 35, Home and session composers retained the approved compact/elevated multiline layouts and keyboard clearance
- [x] In Build 35, Cloud and Computer exposed their distinct pickers and the Computer model menu exposed the live Recommended, Recent, searchable All Models catalog
- [x] In Build 35, local session creation and exact model/variant selection behaved correctly
- [ ] In Build 36, confirm Devin remains in the transparent track immediately above both Cloud and Computer session composers with short and long histories, while the keyboard is open, and during start/walk/stop transitions
- [x] After the phone-created turn finishes, open that session in Devin Desktop; then send a later phone turn and confirm ownership can alternate without a permanent unavailable state
- [x] Enable `Create new sessions` for the iPhone in Connector and create a harmless Computer session with an approved workspace and selected model
- [x] Confirm the selected model appears on the new local session and the initial prompt receives a reply
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
- [ ] With an enterprise code-scan service user, confirm Security shows 30-day metrics, groups findings by Security Swarm scan, filters severities, and opens an existing remediation session without exposing raw scan identifiers
- [ ] Launch one low-risk finding remediation from Security, confirm exactly one Devin session is created, and confirm a repeated launch returns the safe already-started state
- [ ] Confirm **Start in Devin** is clearly presented as an external handoff until Cognition publishes a supported create-scan API
- [ ] Re-open the QR pairing scanner in both themes and confirm the camera is immediately visible without scrolling, neither full-screen nor narrow, Cancel remains reachable, and backgrounding stops capture
- [ ] In Build 43, test dictation from both Home and an existing Cloud or Computer session: start, mixed typing and speech, stop, cancel, `Organize prompt`, send, permission denial/recovery, interruption, AirPods routing, VoiceOver, and Reduce Motion
- [ ] In Build 43, confirm recording has one visible stop control, the mic remains beside Send, partial/final transcript text is preserved, and no passive companion status bubble appears after completion
- [ ] In Build 43, confirm the companion sits immediately above the composer and visibly reflects waiting, thinking/working, success, blocked, and error states without covering history or controls

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
