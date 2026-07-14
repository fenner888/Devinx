# Public release approval packet

Last updated: July 14, 2026

This packet converts the frozen internal TestFlight candidate into an explicit public-release checklist. It is evidence and a handoff, not permission to submit App Review, publish an OTA update, merge source to a public branch, or release the iOS app. The owner separately authorized and published macOS Connector 0.1.0 on July 14, 2026; that bounded Connector approval does not authorize any other release action.

## Frozen iOS candidate

- Product version: `0.1.0`
- Build: `66`
- Frozen source: `66dccd3`
- Release-evidence source: this post-artifact documentation update (no app changes)
- Bundle identifier: `com.fenner888.devinx`
- IPA: `artifacts/eas/DevinX-0.1.0-66.ipa`
- Size: `21,024,994` bytes
- SHA-256: `a4b7ef263d9957b8e8132d5a9a2f7dd4260edf30af8db27a80ab20255934f354`
- EAS submission: `cf50f27c-61ca-44ad-8388-dcb4c81a7ad3`
- Current state: EAS uploaded Build 66 and scheduled its App Store Connect submission. The EAS job is
  queued at this checkpoint; Apple processing, group availability, and final physical acceptance remain external.

The owner froze the product UI after Build 62, then explicitly reopened and approved the onboarding
presentation in Build 65. Build 66 preserves that implementation and adds only the clarified
Connector/Tailscale boundary now captured in the release documents and draft PR. Screenshots must use
Build 66 after a narrow visual/setup-link spot-check.

## Refreshed automated evidence

The exact Node `24.18.0` release runtime passed:

- lint with zero warnings;
- strict TypeScript for the mobile app and Connector;
- 80 Jest suites and 575 tests;
- app and Connector production builds;
- the repository audit gate;
- dry-run lockfile installation;
- tracked-file secret-pattern scanning;
- `npm audit` with zero high and zero critical findings.

The remaining 21 moderate advisories are transitive. `markdown-it` has no available fix, while the relevant Expo/PostCSS/UUID fixes require a breaking Expo 57 migration. They are documented risk, not silently ignored findings.

The Build 66 IPA size, checksum, strict code signature, entitlements, microphone disclosure,
exempt-encryption declaration, and all ten privacy manifests were independently reverified against
the frozen artifact.

## Published signed Connector

- Release: `connector-v0.1.0`
- Source: `106f163d53662c5a5b9a5df6d787f208e21a2217`
- Architecture: Apple silicon (`arm64`)
- Bundled Node: `24.18.0`
- SHA-256: `659142d305644b42f1c29302faea0ebeded1dbb0085a09bb0512d1ce51710d73`
- Current signature: Developer ID Application with hardened runtime and secure timestamp

Deterministic verification passed checksum, read-only DMG mounting, the exact Applications symlink,
clean-copy installation, deliberate replacement, temporary removal, strict nested signatures, the
entitlement allowlist, source-map absence, and bundled-Node inspection. Apple accepted the app and
DMG notarization submissions, both tickets were stapled, and Gatekeeper reports `Notarized Developer
ID`.

The owner explicitly authorized publication on July 14, 2026. The notarized/stapled DMG and adjacent
checksum are available from the official GitHub release, `/releases/latest` resolves correctly, and
Gatekeeper accepts the downloaded artifact. A separate fresh-account lifecycle exercise remains a
hardening follow-up and is not claimed as completed evidence.

## App Store product metadata

Use the existing listing draft as the copy source:

- Name: **DevinX**
- Subtitle: **Unofficial client for Devin**
- Primary category: **Developer Tools**
- Secondary category: **Productivity**
- Privacy URL: `https://github.com/fenner888/Devinx/blob/main/PRIVACY.md`
- Support URL: `https://github.com/fenner888/Devinx/issues`

The public support URL is live. The public privacy URL is also live, but its current content does **not** match the frozen local `PRIVACY.md`. Publishing the frozen policy to the public URL and byte-verifying it is a release blocker. Do not publish or merge that source change without explicit approval.

The authenticated App Store Connect draft contains the approved description, keywords, support URL,
review notes, subtitle, primary/secondary categories, and the prior processed build. Build 66 must be
selected after Apple processing completes. Manual release is selected, so
an App Review approval cannot automatically publish the app. Apple-silicon Mac and Vision Pro
availability are disabled because those platforms have not been validated.

Apple metadata work still requires:

- the actual age-rating questionnaire;
- the Content Rights declaration and retained evidence for the Devin name, companion artwork, Cognition reference/mark, and bundled model-provider marks;
- price, territories, copyright, and trader/compliance selections;
- final review contact details and a private non-production review account entered directly in App Store Connect, never committed or pasted into chat.

Use `docs/app-store-owner-decisions.md` for the recommended choices and the exact owner approvals
that remain. Do not infer legal, commercial, territory, rights, or trader answers from product code.

Useful official references:

- [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Platform version and review information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- [Submitting for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review)

## App privacy answers

The conservative Store answer set remains the source-backed matrix in `docs/app-privacy-review.md`:

| Data type | Purpose | Linked to user | Tracking |
| --- | --- | --- | --- |
| User ID | App Functionality | Yes | No |
| Other User Content | App Functionality | Yes | No |
| Photos or Videos | App Functionality | Yes | No |
| Device ID, limited to Expo's randomized installation token | App Functionality | No | No |

Do not claim **Data Not Collected** merely because the compiled privacy manifests declare no SDK-side collected-data types. DevinX sends user-directed account and session content to the selected Devin service, and the Store answers must include relevant third-party partner handling. The four conservative data-type answers above are saved as an unpublished App Store Connect draft and match its Product Page Preview: Identifiers and User Content linked to the user, plus an Identifier not linked to the user. Do not click **Publish** until the public policy matches the frozen policy and the final answers have been compared line by line with the app and `docs/app-privacy-review.md`.

The precise retention treatment for the selected Pro/Max Devin account must be confirmed against the applicable current customer terms. Enterprise retention documentation alone is not proof of the individual-plan treatment.

Official reference: [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).

## Screenshot set

Because the binary supports iPad, capture both device families from Build 66 after the narrow visual spot-check:

- iPhone 6.5-inch portrait in the slot currently requested by App Store Connect;
- iPad 13-inch portrait, `2064 x 2752` or `2048 x 2732`;
- PNG or JPEG without transparency;
- sanitized non-production data only;
- one coherent sequence covering Home, a live session, Cloud/Computer origin clarity, voice/Scribe, and supported product-management surfaces.

Apple accepts one to ten screenshots per device size. See [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications?page_id=52545).

## Required physical evidence for Build 66

Complete and record:

1. the consolidated Cloud, Computer, and combined-mode golden path;
2. the corrected **Name this Mac** keyboard-clearance flow on the smallest supported iPhone available;
3. session-composer keyboard dismissal and draft preservation;
4. on-device voice permission, start, streaming text, stop, cancel, mixed typing, Organize prompt, interruption, AirPods, VoiceOver, and Reduce Motion paths;
5. Cloud Normal/Fast where the account is entitled and a Computer Adaptive/model dispatch confirmed by the live session;
6. Security Work exact `code_scan` filtering and navigation;
7. disconnect, revoke, re-pair, data wipe, and unauthenticated cold launch;
8. light/dark, Dynamic Type, VoiceOver, scanner, and iPad layout checks;
9. the cold-launch, 200-row scroll, one-hour battery, and seven-day TestFlight stability evidence in `docs/physical-performance-checklist.md`;
10. the timed internal OTA rollback drill, only after separate approval to publish the internal update.

## Approval sequence

1. Complete and record the Build 66 physical and performance/stability evidence.
2. Approve publication of the frozen privacy policy, then byte-verify the public URL.
3. Keep the published Connector checksum/release verification current; complete the separate fresh-account lifecycle hardening exercise when practical.
4. Complete App Store Connect metadata, privacy, age rating, Content Rights, price/availability, screenshots, and private review information.
5. Audit the final App Store product page against this packet and the exact binary.
6. Obtain explicit approval to click **Submit for Review**.
7. After Apple approval, obtain a separate explicit approval before manually releasing the app or publishing the Connector.

Any new source change after the frozen candidate requires a new build, artifact verification, affected test reruns, and an updated packet.
