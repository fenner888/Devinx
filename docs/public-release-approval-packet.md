# Public release approval packet

Last updated: July 13, 2026

This packet converts the frozen internal TestFlight candidate into an explicit public-release checklist. It is evidence and a handoff, not permission to submit App Review, publish the Connector, publish an OTA update, merge source to a public branch, or release the app. Each of those actions still requires the approval identified below.

## Frozen iOS candidate

- Product version: `0.1.0`
- Build: `62`
- Frozen source: `0c81638`
- Release-evidence source: `4c5f139`
- Bundle identifier: `com.fenner888.devinx`
- IPA: `artifacts/eas/DevinX-0.1.0-62.ipa`
- Size: `20,915,834` bytes
- SHA-256: `e5bff1a0a29fdd6c88b6cce4fb24890b84c73d79ceba5719e893d83db005d353`
- EAS submission: `4fa362d7-364c-4901-9372-7e3453d1b351`
- Current state: uploaded for internal TestFlight; Apple processing and final physical acceptance remain external.

The owner froze the design after Build 62. Screenshots must use this exact build unless a release-blocking defect requires a new build and reopens affected validation.

## Refreshed automated evidence

The exact Node `24.18.0` release runtime passed:

- lint with zero warnings;
- strict TypeScript for the mobile app and Connector;
- 74 Jest suites and 545 tests;
- app and Connector production builds;
- the repository audit gate;
- dry-run lockfile installation;
- tracked-file secret-pattern scanning;
- `npm audit` with zero high and zero critical findings.

The remaining 21 moderate advisories are transitive. `markdown-it` has no available fix, while the relevant Expo/PostCSS/UUID fixes require a breaking Expo 57 migration. They are documented risk, not silently ignored findings.

The Build 62 IPA size and checksum were independently reverified against the frozen artifact.

## Current private Connector artifact

- Source: `4c5f139`
- Architecture: Apple silicon (`arm64`)
- Bundled Node: `24.18.0`
- SHA-256: `8fffe9b33afcae1d152f63f0cf8fed4c99a3b3864e0619c88fa1c78e7843dd3e`
- Current signature: ad hoc, private testing only

Deterministic verification passed checksum, read-only DMG mounting, the exact Applications symlink, clean-copy installation, deliberate replacement, temporary removal, strict nested signatures, the entitlement allowlist, source-map absence, and bundled-Node inspection. Gatekeeper rejection is expected and required for this ad-hoc artifact.

Public Connector distribution remains blocked until the Apple Developer Program Account Holder installs a **Developer ID Application** identity, stores the `devinx-notary` Keychain profile, signs with hardened runtime and timestamping, notarizes and staples the app and DMG, and completes the clean-account lifecycle test. See `docs/macos-release-credential-checkpoint.md`.

## App Store product metadata

Use the existing listing draft as the copy source:

- Name: **DevinX**
- Subtitle: **Unofficial client for Devin**
- Primary category: **Developer Tools**
- Secondary category: **Productivity**
- Privacy URL: `https://github.com/fenner888/Devinx/blob/main/PRIVACY.md`
- Support URL: `https://github.com/fenner888/Devinx/issues`

The public support URL is live. The public privacy URL is also live, but its current content does **not** match the frozen local `PRIVACY.md`. Publishing the frozen policy to the public URL and byte-verifying it is a release blocker. Do not publish or merge that source change without explicit approval.

Apple metadata work still requires:

- the actual age-rating questionnaire;
- the Content Rights declaration and retained evidence for the Devin name, companion artwork, Cognition reference/mark, and bundled model-provider marks;
- price, territories, copyright, and trader/compliance selections;
- a manual-release selection so App Review approval cannot automatically publish the app;
- final review contact details, notes, and a private non-production review account entered directly in App Store Connect, never committed or pasted into chat.

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

Do not claim **Data Not Collected** merely because the compiled privacy manifests declare no SDK-side collected-data types. DevinX sends user-directed account and session content to the selected Devin service, and the Store answers must include relevant third-party partner handling. Final answers must be published in App Store Connect and compared line by line with the frozen app, policy, and `docs/app-privacy-review.md`.

The precise retention treatment for the selected Pro/Max Devin account must be confirmed against the applicable current customer terms. Enterprise retention documentation alone is not proof of the individual-plan treatment.

Official reference: [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy).

## Screenshot set

Because the binary supports iPad, capture both device families from Build 62 after physical acceptance:

- iPhone 6.9-inch portrait, preferably `1320 x 2868`;
- iPad 13-inch portrait, `2064 x 2752` or `2048 x 2732`;
- PNG or JPEG without transparency;
- sanitized non-production data only;
- one coherent sequence covering Home, a live session, Cloud/Computer origin clarity, voice/Scribe, and supported product-management surfaces.

Apple accepts one to ten screenshots per device size. See [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications?page_id=52545).

## Required physical evidence for Build 62

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

1. Complete and record the Build 62 physical and performance/stability evidence.
2. Approve publication of the frozen privacy policy, then byte-verify the public URL.
3. Install the Developer ID and notary credentials; produce, notarize, staple, and clean-account test the public Connector candidate.
4. Complete App Store Connect metadata, privacy, age rating, Content Rights, price/availability, screenshots, and private review information.
5. Audit the final App Store product page against this packet and the exact binary.
6. Obtain explicit approval to click **Submit for Review**.
7. After Apple approval, obtain a separate explicit approval before manually releasing the app or publishing the Connector.

Any new source change after the frozen candidate requires a new build, artifact verification, affected test reruns, and an updated packet.
