# Local recovery and release integrity

## Scope

Restore iPhone-to-Mac pairing and the Local product vocabulary using current
main as the release baseline. Preserve Windows recovery and macOS process
cleanup. Do not roll back signing, consent, authentication, or permissions.

## Evidence (2026-09-15)

- User confirms iOS build 81; camera recognizes QR, pairing subsequently fails.
- The build-81 checkout and commit 813de8c use strict pairing protocol 1 and
  HTTPS-only QR endpoints. Current main and installed Connector 0.1.7 use
  protocol 2 and explicit Tailscale transport security. Actual uploaded binary
  source remains to be verified; checkout evidence alone is not binary proof.
- Current main contains Local labels and newer session/model/Windows behavior
  absent from that old branch. Recovery must not build from the old checkout.
- Mac shell retains QR images after runtime termination and has no independent
  expiry display guard. The runtime already refreshes offers, but a new offer
  does not clear a stale pending-review view after its approval window expires.
- Live local ACP discovery succeeds with CLI 3000.10.27. Capabilities must be
  individually mapped; desktop feature parity is not implied by ACP support.

## Required behavior

1. Current iOS and Connector pairing schemas agree on version, transport,
   signed identity, expiry, approval and granular permissions. Reject malformed,
   expired and incompatible offers with actionable messages, without relaxing
   validation or displaying QR secrets.
2. Visible product mode is Local; persisted computer identifiers remain stable.
3. Connector must not present stale QR offers as usable. Refresh expired offers
   while running, preserve pending approval, and clear QR on stop/failure.
4. QR has an opaque white quiet zone and crisp rendering in either appearance.
5. ACP audit distinguishes supported, exposed, unavailable and untested paths;
   capability failures must not report a paired but unreachable device as Ready.
   Cold model discovery uses the bounded account catalog before any legacy
   session-load fallback, including accounts without sessions.
6. Release provenance records source commit, clean status, app/native versions,
   pairing protocol and minimum Connector version. Prevent stale-branch release.

## Release gates

- Typecheck, lint, pairing/permission regressions, full tests, bridge build,
  dependency audit and secret scan.
- Native build and QR decode/lifecycle checks after Xcode setup is available.
- Physical iPhone pairing/approval, saved-pairing restart, Local session list,
  models/configuration, create/send/read/cancel and consent testing. A fixture
  test is not a physical-device pass.
- Signed iOS build newer than 81, App Store Connect processing, internal Team
  (Expo) and external DevinX Early Access assignment/Beta Review verified live.
- If Connector changes ship: signed/notarized/stapled release and installed
  runtime verification. Source changes alone are not a distributed fix.

## Status

Investigation in progress; nothing from this recovery has been published.
