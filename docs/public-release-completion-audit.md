# Public release completion audit

Last audited: July 12, 2026

This maps the full build specification and current Connector objective to evidence. `Verified` means current authoritative evidence covers the requirement. `Physical` and `External` are release blockers, not optional follow-up. A passing internal upload is not proof of public-release readiness.

| Requirement | Status | Authoritative evidence / remaining proof |
|---|---|---|
| Secure cloud credentials | Verified | `src/auth/keychain.ts` uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; `app.json` sets `NSFileProtectionComplete`; key-leak CI and wipe tests pass |
| Protected Connector routes | Verified automated | `bridge/src/listener.ts`, dispatcher/service authorization, replay/rate-limit tests, and `docs/authorization-matrix.md`; physical revocation remains separately required |
| Zod validation at API, Connector, IPC, and ACP boundaries | Verified automated | Devin schemas, bridge schemas, malformed/oversize request suites, strict TypeScript, and authorization matrix |
| Unauthorized resource non-disclosure | Verified automated | Generic `404` cases in bridge/listener/pairing tests and the IDOR matrix; physical post-revocation behavior remains required |
| Disconnect wipes Keychain, SQLite, query cache, drafts, templates, and remembered session context | Implemented; physical required | Keychain/cache tests plus `src/lib/localUserData.ts`; final device test must inspect disconnect and cold launch |
| App-switcher content protection | Verified automated; physical spot-check | Root `PrivacyShield`, AppState tests, and `NSFileProtectionComplete` |
| Deep-link path/auth safety | Verified automated; physical spot-check | Session route validates IDs; unauthenticated root routing returns to onboarding; deep-link fuzz tests pass |
| Dependency and secret hygiene | Verified for current lock | Exact lockfile install, 0 high/critical audit, documented moderate transitive advisories, Dependabot, key-leak and secret scans; repeat on final commit |
| Privacy disclosures and manifests | Verified artifact; human publication required | Build 30 has 10 manifests with no collected-data declarations/tracking and no notification/reporting artifacts; `PRIVACY.md`, in-app Privacy, and `docs/app-privacy-review.md` are aligned; App Store answers and stable public policy URL remain unpublished |
| Accessibility semantics and contrast | Verified automated; physical required | Contrast/static-label tests; VoiceOver, Dynamic Type, scanner, reduced motion, and both themes require final iPhone checks |
| Companion behavior and local history | Implemented; physical required | Component/timeline tests and prior Build 14 steering evidence; final candidate must prove history boundaries, scroll behavior, smooth travel, and reduced motion |
| Secure Tailscale pairing and device permissions | Implemented; physical required | Real pairing previously succeeded; final build must prove approve/deny, read/send separation, phone removal, Mac revocation, and re-pair |
| Cloud-only, Computer-only, and combined modes | Implemented; physical required | Routing/model tests and UI implementation; cold-launch persistence requires final device proof |
| Production build/export and artifact integrity | Verified artifact for Build 30 | Build 30 signature, metadata, entitlements, update channel/runtime, `NSFileProtectionComplete`, exempt-encryption declaration, 10 privacy manifests, and absence of APS entitlement passed; App Store upload status is recorded separately in `docs/release-readiness.md` |
| Performance targets | Unverified physical | Execute `docs/physical-performance-checklist.md`: cold launch, 200-row scroll, one-hour battery, and seven-day stability |
| Cloud API real-rate behavior | Unverified external test | Use a dedicated non-production account and a release-approved, bounded burst/sustained protocol; do not risk a production account merely to satisfy the gate |
| End-to-end golden path and destructive wipe | Partial | Unit/integration coverage is extensive; Maestro is not installed and no executed release-mode E2E artifact exists. A physical golden path plus wipe is required |
| Trademark/listing posture | Drafted; human review required | Disclaimer is in onboarding/settings/privacy; subtitle is within Apple's 30-character limit; listing draft is `docs/app-store-listing-draft.md` |
| OTA rollback | Plan prepared; drill required | `docs/release-rollback-plan.md`; timed production-channel-compatible internal drill remains unexecuted and needs explicit approval before publishing an update |
| macOS Connector distribution | External credential and physical clean-account gates | Notarization workflow fails closed; Developer ID Application identity, notarization, staple/Gatekeeper, install/update/uninstall remain outstanding |
| Windows/Linux follow-up | Roadmap complete, implementations deferred | `docs/connector-platform-roadmap.md`; neither platform may be advertised until its own implementation and gates pass |
| App Review credential/screenshots | External | Private non-production credential, review contact, final screenshots, and clean-install verification remain required |
| App Review/public release | Explicit approval required | No App Review submission, public Connector artifact, privacy-policy publication, EAS production update, or public release may occur without approval |

## Current stopping conditions

The next final candidate cannot be called complete until the consolidated iPhone test, performance/stability evidence, exact Devin-account retention confirmation, App Store privacy publication, Developer ID/notarization and clean-account Connector checks, private review credential, final screenshots, and explicit release approval are all recorded. Build-spec targets such as the seven-day crash-free window and timed OTA rollback drill remain real gates unless the specification is explicitly changed.
