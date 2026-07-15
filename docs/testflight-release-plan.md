# TestFlight and App Store release plan

Prepared: July 15, 2026

## Goal

Use Build 67 for controlled beta access while the public App Store listing is completed and reviewed.
TestFlight distribution and public App Store release are separate approval paths.

## Recommended rollout

1. Keep the existing internal group for the owner and trusted App Store Connect users.
2. Create an external group named `DevinX Early Access`.
3. Add Build 67, complete export-compliance and TestFlight test information, and submit the build for
   TestFlight Beta App Review.
4. Begin with email-only invitations to a small trusted cohort. Do not create a public link for the
   first cohort.
5. Collect crashes, tester sessions, and written feedback while the public App Store metadata,
   privacy disclosures, review account, and legal/commercial fields are finalized.
6. Submit version 1.0 for public App Review only after every release blocker in
   `docs/build-67-release-handoff.md` is closed and the owner approves the exact submission.
7. Keep manual release enabled so approval does not automatically publish the app before the owner is
   ready.

## Apple boundaries

- Internal testing supports up to 100 App Store Connect users with access to the app.
- External testing supports up to 10,000 people by email or public link and may require TestFlight Beta
  App Review before testers can install the build.
- A TestFlight build is available for up to 90 days.
- External beta approval does not equal approval for public App Store distribution.

Official references:

- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information

## Stop boundaries

- Do not give ordinary external testers App Store Connect roles merely to avoid Beta App Review.
- Do not publish a TestFlight public link until the email-only cohort is stable.
- Do not select the final public App Store submission or release controls until the exact listing,
  review access, privacy answers, and owner/legal fields have been verified.
