# iOS release rollback plan

Last updated: July 11, 2026

This plan covers internal TestFlight and a future public release. It does not authorize an EAS Update, App Store submission, phased release, or public publication.

## Decision boundary

- JavaScript/assets-only defects that do not change native modules, entitlements, permissions, privacy behavior, encryption declarations, or Connector protocol compatibility may use EAS Update on the existing compatible runtime.
- Native, security, privacy, authentication, storage, entitlement, dependency, or protocol defects require a new signed binary. Stop the affected rollout; do not try to hide such a change in an OTA update.
- Credential exposure or unauthorized resource access is an incident: disable the affected path, rotate exposed credentials, preserve sanitized evidence, and notify affected parties before resuming distribution.

## OTA rollback drill

1. Record the incident start time, selected binary version/build, production runtime version, current update ID, and reason for rollback.
2. Freeze further production updates and identify a previously verified clean commit compatible with the same runtime.
3. In a clean worktree on pinned Node 24.18.0, run `npm ci`, `npm run ci`, and a production export. Re-run secret and privacy gates if the rollback touches data flow.
4. Show the exact commit, channel, message, and diff to the release owner. Obtain explicit approval before invoking `eas update --channel production`.
5. Publish the known-good compatible update, record the returned update/group IDs, and verify it on an internal TestFlight installation after a cold launch.
6. Verify Cloud-only, Computer-only, and combined routing, then repeat the exact failing scenario. Confirm no incompatible binary consumes the update.
7. Record elapsed time. The build-spec target is under 15 minutes; a plan is not proof until a timed drill succeeds.

## Binary rollback

1. Remove the affected build from TestFlight groups or pause the public release in App Store Connect.
2. If a previously approved App Store version remains available, use App Store Connect's supported version/release controls; otherwise prepare a corrected incremented binary.
3. Run the full automated, physical, privacy, authorization, and artifact checks on the corrected binary.
4. Submit only after explicit approval and retain the prior build, commit, checksum, submission ID, and incident record.

## Required evidence before public release

- One successful timed internal OTA rollback drill with no sensitive content in commands, update messages, or logs
- A recorded known-good commit and update ID for the final runtime
- A named release owner with App Store Connect and Expo permissions
- Confirmation that the production channel cannot be updated by unreviewed CI or an unprotected personal token
