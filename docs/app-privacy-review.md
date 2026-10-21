# App privacy review

Last reviewed: July 13, 2026

This document maps the release-candidate source to App Store Connect privacy answers. It is engineering evidence, not a substitute for confirming the current retention practices of Expo, Tailscale, or any future crash-reporting provider before publication.

Apple requires disclosures to include third-party partner collection, to describe collection used only for app functionality, and to stay current as practices change. The privacy policy URL is required. See Apple's [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) and [Manage App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).

## Production data-flow inventory

| Destination                                | Data                                                                                                                                                                              | Purpose                               | Current release behavior                                                                                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User-approved Mac over Tailscale           | Signed device/request identifiers, opaque session handles, approved metadata, and approved message text                                                                           | Optional local-computer functionality | Direct device-to-device path; no Otterin relay; local files, tool payloads, private thoughts, and Devin credentials are excluded                                                                                                         |
| Expo Updates                               | Device operating system, Expo project ID, randomized per-install update token, and normal network metadata                                                                        | Deliver a compatible app update       | Expo documents the random token as the mechanism for determining whether an installation requested an update; no prompts, session messages, repository names, attachments, Devin credentials, or Connector pairing secrets are included |
| Crash reporting provider                   | None                                                                                                                                                                              | Not bundled or configured             | Adding any reporting SDK or destination requires a new privacy review and updated App Store answers before release                                                                                                                      |
| Remote push provider                       | None                                                                                                                                                                              | Disabled                              | Automatic Expo push-token registration and the unused notifications dependency were removed from the release candidate                                                                                                                  |
| Product analytics provider                 | None                                                                                                                                                                              | Disabled                              | No PostHog or other product-interaction SDK is enabled                                                                                                                                                                                  |

On-device preferences, caches, and private device keys are processed locally. Wipe-all clears paired-device keys and the local cache. The app does not store Devin sign-in credentials.

## Conservative App Store Connect answers

Use **Yes, data is collected** because Expo's EAS Update service may receive a randomized installation token and device/update metadata for app functionality.

| Apple data type | Purpose                                                           | Linked to user | Tracking |
| --------------- | ----------------------------------------------------------------- | -------------- | -------- |
| Device ID       | App Functionality (EAS Update randomized installation token)     | No             | No       |

Do not select Product Interaction, Advertising Data, Device ID for advertising, or tracking based on the current source. The EAS Update installation token belongs under Device ID for App Functionality only. Do not select Crash Data while no reporting SDK or destination is present. If crash reporting, analytics, push registration, or a new data destination is enabled, stop and update this matrix before submission.

## Official policy evidence reviewed

- Expo's [Privacy Explained](https://expo.dev/privacy-explained) says EAS Update requests include the operating system, project ID, and a random installation token. Expo's [Privacy Policy](https://expo.dev/privacy) says information is retained only as reasonably necessary for the stated purposes, and its [Security & Compliance page](https://expo.dev/security) describes encryption and service-data removal practices.
- Tailscale's [Data Retention and Deletion Policy](https://tailscale.com/security-policies/data-retention-deletion) states that live customer account/tailnet data is retained for the contract duration and client logs for 12 months. Otterin sends approved Connector session content device-to-device and does not operate a relay, but the user separately relies on Tailscale's network and account service.

## Required human confirmation before App Review

- Recheck Expo's update-service privacy terms immediately before submission and compare them with the final bundled SDK privacy manifests.
- Confirm the public privacy policy explains collection, use, retention/deletion, consent revocation, and third-party protections.
- Enter or update App Store Connect answers using an Account Holder, Admin, or App Manager account and compare the Product Page Preview with this matrix.
- Re-run the packaged-manifest inspection against the exact final IPA.
