# Security policy

DevinX handles cloud credentials, paired-device credentials, prompts, session
content, repository context, and local computer access. Please report suspected
security vulnerabilities privately and avoid exposing user data or working
exploit details in a public issue.

## Supported versions

Security fixes are made against the latest source on the default branch and the
latest distributed DevinX release. Development builds, superseded TestFlight
builds, and unpublished Connector artifacts are not supported releases.

| Version                     | Supported |
| --------------------------- | --------- |
| Latest public release       | Yes       |
| Default branch              | Yes       |
| Older or development builds | No        |

Until a public release exists, the default branch is the only supported source
checkpoint. This does not make unsigned development artifacts suitable for
public installation.

## Reporting a vulnerability

1. Open this repository's **Security** tab and choose **Report a
   vulnerability** to create a private GitHub security advisory.
2. If private vulnerability reporting is unavailable, open a minimal public
   issue asking the maintainer to establish a private reporting channel. Do not
   include vulnerability details, credentials, personal data, session content,
   repository names, private network addresses, QR payloads, or proof-of-concept
   code in that issue.
3. Include privately, when available:
   - the affected DevinX app, Connector, route, or component;
   - the version, build number, commit, and operating system;
   - reproduction steps and the expected security boundary;
   - impact, prerequisites, and whether cross-account or cross-device access is
     possible;
   - sanitized logs or a minimal proof of concept with all secrets removed.

Never send a real Devin credential, Connector credential, signing key, reusable
Tailscale authentication key, private QR payload, or customer data. Revoke any
credential that may have been exposed before continuing the report.

## What to expect

Reports are reviewed on a best-effort basis. The maintainer will attempt to
acknowledge a reproducible report, assess severity, coordinate remediation, and
credit the reporter when requested and appropriate. No response time, fix time,
bug bounty, payment, or disclosure date is guaranteed.

Please allow a reasonable remediation period before public disclosure. If a
report concerns Cognition AI, Devin, Tailscale, Expo, Apple, or another provider
rather than DevinX, also follow that provider's security-reporting process.

## Security boundaries

High-priority reports include, but are not limited to:

- exposed or recoverable cloud or paired-device credentials;
- missing authorization, IDOR, cross-account, or cross-device access;
- signature, nonce, replay, origin-pinning, revocation, or rate-limit bypasses;
- arbitrary command, file, ACP, or local-session access outside an approved
  Connector grant;
- secret or session-content leakage through logs, diagnostics, analytics,
  screenshots, caches, backups, or error messages;
- unauthorized microphone capture or transmission of audio;
- unsafe update, installer, code-signing, notarization, or dependency behavior;
- a vulnerability that allows an unauthenticated network client to discover or
  control protected resources.

Feature requests, availability problems without a security impact, and ordinary
support questions belong in the public issue tracker. Public issues must never
contain secrets or sensitive user content.

## Project security requirements

Contributions must preserve the repository's security gates: server-side
authorization on protected routes, Zod validation at external boundaries,
generic `404` non-disclosure for unauthorized resources, rate limits on auth
and write paths, Keychain or secure-store credential handling, no hardcoded
secrets, no auth tokens in browser storage, verified dependencies, secret and
authorization scans, and fail-closed Connector distribution checks.
