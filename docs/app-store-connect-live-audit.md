# App Store Connect live audit

Audited: July 14, 2026

This records the authenticated App Store Connect state after the Build 64 processing and attachment
refresh. It does not authorize App Review submission, privacy publication, or public release.

July 14 update: Build 66 remains historical signed TestFlight evidence, but it is no longer the final
screenshot/release target. Build 67 was exported and independently verified as iPhone-only, uploaded
under EAS submission `3416da8d-2299-45b8-89d7-1a835ed042c5`, processed by Apple, and installed by the
owner from TestFlight on a physical iPhone. Installation is not full release acceptance; do not replace
the attached version build until the remaining Build 67 acceptance checks pass. Connector 0.1.0 is now
published, signed, notarized, stapled, checksum-verified, and Gatekeeper accepted.

## Confirmed and saved

- Build `0.1.0 (64)` finished processing and is **Ready to Submit**.
- Build 64 is attached to App Store version `1.0`, which remains **Prepare for Submission**.
- The description, keywords, support URL, review notes, subtitle, primary category, and secondary category are saved from the reviewed release drafts.
- **Manually release this version** is selected.
- Apple-silicon Mac and Apple Vision Pro availability are disabled because neither platform has been validated.
- The Privacy Policy URL field points to the intended public GitHub policy path.
- The unpublished App Privacy draft contains:
  - Photos or Videos — App Functionality, linked to the user, no tracking;
  - Other User Content — App Functionality, linked to the user, no tracking;
  - User ID — App Functionality, linked to the user, no tracking;
  - Device ID — App Functionality, not linked to the user, no tracking.
- App Store Connect's preview consequently shows Identifiers and User Content under **Data Linked to You**, and an Identifier under **Data Not Linked to You**.
- Build 66 still advertises iPad support, so its live media manager requests both iPhone 6.5-inch and
  iPad 13-inch sets. Build 67 is intentionally configured with `supportsTablet: false`; after it is
  selected for the version, the initial release should require only the iPhone set.
- Build 64 is assigned to the one-tester **Team (Expo)** internal group. The build has one invite and
  no installs, sessions, crashes, or feedback recorded at this checkpoint.

## Intentionally not completed

- **Add for Review** was not selected.
- The App Privacy draft was not published because the public policy file does not match the frozen local policy.
- Age Rating was not answered because the questionnaire requires product/legal judgments about user-generated content, chat, unrestricted web access, and related categories.
- Content Rights was not answered because DevinX displays or accesses third-party content and marks; evidence for the required rights declaration must be retained before selecting an answer.
- Accessibility declarations were not made because the remaining VoiceOver, Voice Control, Larger Text, contrast, color, and Reduce Motion claims require physical evidence.
- Price, territories, copyright, review contact, and a private non-production review credential are unset.
- The existing non-trader Digital Services Act status was not changed; any update requires an owner/legal decision and Apple's business verification flow.
- No review attachment was uploaded.

## Publication blockers

1. Complete the narrow physical and performance/stability checks for the processed and installed
   iPhone-only Build 67 candidate.
2. Approve publication of the frozen `PRIVACY.md`, update the public URL, and byte-verify it before publishing the App Privacy draft.
3. Supply the human/legal/commercial answers for Age Rating, Content Rights, price, territories, copyright, and trader status.
4. Enter review contact information and a private non-production review account directly in App Store Connect.
5. Upload the five approved sanitized iPhone 6.5-inch compositions recorded in
   `docs/app-store-screenshot-manifest.md`. Exclude the rejected model-picker source and do not provide
   an iPad set for the iPhone-only initial release.
6. Keep the published Connector release/checksum verification current; complete the separate fresh-account lifecycle hardening exercise when practical.
7. Obtain separate explicit approval before submitting App Review.
