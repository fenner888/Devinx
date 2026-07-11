# App privacy review

Last reviewed: July 11, 2026

This document maps the release-candidate source to App Store Connect privacy answers. It is engineering evidence, not a substitute for confirming the current retention practices of Cognition, Expo, Tailscale, or any future crash-reporting provider before publication.

Apple requires disclosures to include third-party partner collection, to describe collection used only for app functionality, and to stay current as practices change. The privacy policy URL is required. See Apple's [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) and [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).

## Production data-flow inventory

| Destination | Data | Purpose | Current release behavior |
|---|---|---|---|
| Cognition Devin API | Devin account credential, account/organization identifiers, prompts, session messages and metadata, selected attachments | Authentication and app functionality | Sent directly over TLS; credentials remain in Keychain on the phone and are never sent to DevinX infrastructure |
| User-approved Mac over Tailscale | Signed device/request identifiers, opaque session handles, approved metadata, and approved message text | Optional local-computer functionality | Direct device-to-device path; no DevinX relay; local files, tool payloads, private thoughts, and Devin credentials are excluded |
| Expo Updates | Runtime/app version and normal update-request transport metadata | Deliver a compatible app update | No prompts, session messages, repository names, attachments, Devin credentials, or Connector pairing secrets are included |
| Sentry | None in the current production configuration | Disabled | `EXPO_PUBLIC_SENTRY_DSN` is absent; enabling it requires a new privacy review and updated App Store answers before release |
| Remote push provider | None | Disabled | Automatic Expo push-token registration and the unused notifications dependency were removed from the release candidate |
| Product analytics provider | None | Disabled | No PostHog or other product-interaction SDK is enabled |

On-device preferences, caches, private device keys, and credentials are not App Store "collection" merely because the app processes them locally. The logout/disconnect gates verify credential and cache deletion.

## Conservative App Store Connect answers

Use **Yes, data is collected** because Cognition is a third-party partner that receives and retains account-linked data needed for Devin functionality.

| Apple data type | Purpose | Linked to user | Tracking |
|---|---|---|---|
| User ID | App Functionality | Yes | No |
| Other User Content | App Functionality | Yes | No |
| Photos and Videos | App Functionality, only when attached by the user | Yes | No |

Do not select Product Interaction, Advertising Data, Device ID for advertising, or tracking based on the current source. Do not select Crash Data while the production Sentry destination remains absent. If Sentry, analytics, push registration, a DevinX relay, or additional attachment categories are enabled, stop and update this matrix before submission.

## Required human confirmation before App Review

- Confirm Cognition's current retention and account-linkage treatment for prompts, messages, identifiers, and attachments.
- Confirm Expo's current update-service privacy terms and the final bundled SDK privacy manifests.
- Confirm the public privacy policy explains collection, use, retention/deletion, consent revocation, and third-party protections.
- Enter or update App Store Connect answers using an Account Holder, Admin, or App Manager account and compare the Product Page Preview with this matrix.
- Re-run the packaged-manifest inspection against the exact final IPA.
