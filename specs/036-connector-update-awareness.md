# Connector update awareness

Status: approved for Connector 0.1.2 and the next iPhone TestFlight build

## Purpose

DevinX must tell a paired-computer user when the installed DevinX Connector is too old for the
mobile client. The Connector must also be able to tell its Mac user when a newer signed release is
available. Updates remain explicit and user-approved: neither app silently downloads, mounts, or
executes an installer.

## Mobile compatibility contract

- Protocol 2 gains an additive authenticated `bridge.version` method guarded by the existing
  `bridge:health` permission and existing per-device rate limit.
- Its strict response is `{ "version": "0.1.2" }`, where the version is a three-component semantic
  version. Existing `bridge.health` and `bridge.features` responses do not change, preserving
  compatibility with already-shipped mobile builds.
- A new mobile client probes `bridge.version` only after loading a stored paired computer. A `400`
  response to this new method is treated as a legacy Connector; unreachable, revoked, malformed,
  and rate-limited responses retain their existing error meanings and are not mislabeled as an
  update.
- The mobile client compares the validated semantic version with its minimum supported Connector
  version. A legacy or older Connector produces a visible **Connector update required** notice and
  an **Open official release** action to
  `https://github.com/fenner888/Devinx/releases/latest`.

## macOS release check

- Connector checks GitHub's public latest-release API after launch. No Devin credentials, paired
  device data, session data, or telemetry are included in the request.
- The response is decoded into a bounded shape. Only tags matching `connector-vMAJOR.MINOR.PATCH`
  and release URLs on `github.com/fenner888/Devinx/releases/` are accepted.
- Network, decoding, or validation failure is non-fatal and does not affect pairing or sessions.
- When a higher version exists, Connector shows **Update available** with a user-initiated link to
  the validated official release page. It never downloads or runs the artifact itself.

## Security and release gates

- Every bridge request remains device-signed, server-authorized, strictly validated, replay
  protected, and rate limited.
- No package or dependency is added.
- The public Connector artifact must retain Developer ID signing, Apple notarization, stapling,
  Gatekeeper acceptance, the bundled MIT license, and an adjacent SHA-256 checksum.
- The new iPhone build must pass lint, strict TypeScript, Jest, bridge build, dependency audit, and
  the existing release security gates before TestFlight upload.
