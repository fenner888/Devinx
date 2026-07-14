# App Store Connect live audit

Audited: July 13, 2026

This records the authenticated App Store Connect state after the Build 64 processing and attachment
refresh. It does not authorize App Review submission, privacy publication, or public release.

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
- The live media manager currently requests an iPhone 6.5-inch set and an iPad 13-inch set. Both contain zero screenshots and zero previews.
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

1. Complete and record the Build 64 physical and performance/stability checks.
2. Approve publication of the frozen `PRIVACY.md`, update the public URL, and byte-verify it before publishing the App Privacy draft.
3. Supply the human/legal/commercial answers for Age Rating, Content Rights, price, territories, copyright, and trader status.
4. Enter review contact information and a private non-production review account directly in App Store Connect.
5. Capture sanitized Build 64 iPhone 6.5-inch and iPad 13-inch screenshots using
   `docs/app-store-screenshot-brief.md`.
6. Complete Developer ID signing/notarization and clean-account lifecycle testing for the public macOS Connector.
7. Obtain separate explicit approval before submitting App Review.
