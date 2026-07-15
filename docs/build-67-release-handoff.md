# Build 67 release handoff

Prepared: July 14, 2026

Build `0.1.0 (67)` is the installed iPhone-only TestFlight release candidate. This document is the
short source of truth for what remains before App Review. It does not authorize App Review or a
public iOS release.

## Closed

- Apple processed Build 67 and the owner installed it from TestFlight.
- The signed IPA passed bundle, version/build, iPhone-only device-family, update-channel/runtime,
  file-protection, encryption, entitlements, permission strings, source-artifact, and privacy-manifest
  inspection.
- Exact Node `24.18.0` release CI passed lint, strict app/bridge TypeScript, 80 Jest suites / 575
  tests, app and Connector builds, lockfile dry-run, tracked-file key/sensitive-file scans, and the
  dependency gate with 0 high / 0 critical advisories.
- Connector 0.1.0 is Developer ID signed, notarized, stapled, Gatekeeper accepted, checksum
  published, and reverified from the release artifact.
- The public README rewrite, store copy, conservative privacy-answer draft, authorization matrix,
  security/privacy evidence, and owner-decision packet are prepared on the release branch.
- App Store screenshot compositions 1–5 passed the sanitized visual review.

## Physical acceptance still required on Build 67

Record Pass, Fail, or Not available in `docs/build-62-physical-acceptance-record.md`; that detailed
matrix remains the evidence worksheet even though Build 67 supersedes its original candidate.

1. Cloud: create a harmless Normal session and Fast session when entitled; send/refresh, attachment,
   archive, and disposable terminate paths.
2. Computer: create with an approved workspace and exact live model/Adaptive selection; verify the
   first reply, bounded history, ownership handoff, no raw path/ACP identifier, remove, re-pair, and
   Mac-side revoke.
3. Connection modes: cold-launch Cloud, Computer, and combined modes and confirm correct origins and
   recents.
4. Composer/companion: short and long Cloud/Computer history, keyboard hide/drag/send, translucent
   composer clearance, no hidden final line, and prompt walking/working/stop transitions.
5. Voice: Home plus Cloud and Computer composers; mixed typing/dictation, stop, cancel, Organize
   prompt, permission recovery, background/phone interruption, AirPods, VoiceOver, and Reduce Motion.
6. Accessibility/appearance: light and dark cold launch, Dynamic Type, VoiceOver, Reduce Motion,
   scanner sizing/dismissal/backgrounding, and the native `origin = code_scan` Security Work boundary.
7. Stability: five cold launches per mode, sanitized 200-row scroll, one-hour foreground battery,
   and the seven-day exact-build TestFlight observation window.

Any privacy, authorization, data-loss, crash, hidden-content, or unreachable-accessibility failure
blocks release and requires a superseding build. A cosmetic preference alone does not.

## Product-page work still required

1. Recapture screenshot 6 (model picker) with a clean status bar/Dynamic Island. The current source
   includes personal media artwork and is blocked from upload. Re-review its checksum after replacement.
2. Owner approves the final six-image order; upload only the iPhone 6.5-inch set. iPad is outside the
   initial release scope.
3. Owner explicitly approves the frozen `PRIVACY.md`; merge it to the public `main` branch and verify
   the raw public file against the checksum in `docs/privacy-publication-handoff.md`.
4. Reconcile and publish the App Store privacy answers only after the public policy matches.
5. Enter the owner/legal/commercial fields directly in App Store Connect: age rating, Content Rights,
   free price, territories, copyright, DSA trader status, review contact, and a private non-production
   review credential.
6. Attach Build 67 to version 1.0 only after the owner accepts it as the release binary.

## Stop boundary

After every item above is evidenced, audit the product page once more and stop. Do not select
**Add for Review**, submit App Review, or release publicly until the owner gives separate explicit
approval for that exact action.

