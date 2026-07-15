# DevinX

**Run and steer supported Devin work from your iPhone.**

DevinX is an independent, unofficial mobile client for Devin. It is not affiliated with, endorsed
by, or a product of Cognition AI. Devin, Cognition, and third-party model names and marks belong to
their respective owners.

> **Release status:** iOS `0.1.0 (67)` is the current internal TestFlight candidate. It is not yet a
> public App Store release. The optional Apple-silicon macOS Connector `0.1.0` is signed, notarized,
> and available from [GitHub Releases](https://github.com/fenner888/Devinx/releases/latest).

## What DevinX does

- Starts supported Devin Cloud or Computer sessions from iPhone.
- Shows Cloud and paired-Computer sessions with clear origins and statuses.
- Lets you read session history and send steering messages when Devin needs input.
- Supports on-device dictation and deterministic prompt organization without uploading audio.
- Exposes supported Cloud resources such as repositories/Wiki, Knowledge, Playbooks, Automations,
  Usage, Review, and genuine `code_scan` Security Work only where the documented account/API permits.
- Lets Computer users choose from the live Devin for Terminal model catalog rather than a hardcoded
  list.

DevinX intentionally does not imitate unsupported web-only actions, reuse browser cookies, guess
private endpoints, or claim features that the authenticated Cloud API or local ACP catalog does not
provide.

## Choose how Devin runs

| Mode | What it connects to | What you install |
| --- | --- | --- |
| **Devin Cloud** | Supported Devin Cloud APIs over TLS | DevinX on iPhone only |
| **Computer** | Devin for Terminal sessions on a computer you control | DevinX, Tailscale, and DevinX Connector |
| **Cloud + Computer** | Both sources in one app, with clear origins | Both setups above |

Cloud authentication does not pair a computer. Computer pairing does not copy Devin credentials to
the iPhone. Each path has its own setup, authorization, and revocation boundary.

## Why Computer mode needs Connector

Tailscale and DevinX Connector solve different problems:

1. **Tailscale supplies the private encrypted network route** between the iPhone and computer.
2. **DevinX Connector supplies the trusted local service** that communicates with Devin for
   Terminal, authenticates each phone, enforces permissions, and returns bounded session data.

Tailscale alone does not run a server, expose Devin sessions, authorize a phone, or speak Devin's
local protocol. A Tailscale IP or shared password would work only if compatible server software were
already installed and listening. DevinX instead uses short-lived QR pairing so each phone receives a
separate cryptographic identity, permission set, and revocation path.

## Install DevinX Connector on macOS

Connector `0.1.0` currently supports **Apple-silicon Macs**. Windows, Linux, and Intel Mac packages
are planned but are not supported yet.

1. Install and sign in to [Tailscale](https://tailscale.com/download) on the Mac and iPhone.
2. Confirm Devin for Terminal is installed and authenticated on the Mac.
3. Download the signed DMG from the
   [official DevinX release](https://github.com/fenner888/Devinx/releases/latest).
4. Verify the published SHA-256 checksum, open the DMG, and move **DevinX Connector** to
   Applications.
5. Open Connector. It should report both **Tailscale connected** and **Devin for Terminal detected**.
6. In DevinX on iPhone, open **Settings → Computers → Add Mac**, scan the short-lived code, and
   approve the named iPhone and requested permissions on the Mac.

The iPhone onboarding also offers a guarded assisted-setup prompt for an AI assistant on the Mac.
That prompt installs only the official signed release, verifies its checksum, and stops safely if a
required release or trust check is unavailable. Installation still requires explicit approval on the
Mac; an iPhone app cannot silently install a macOS application.

Normal users should install only the signed release. Source-development commands are documented in
[docs/devinx-connector.md](docs/devinx-connector.md).

## Connector permissions and lifecycle

Computer grants are per iPhone and enforced by the Connector, not by hidden mobile UI state:

- **Read session titles and history**
- **Send messages to sessions**
- **Create new sessions**

The Mac can revoke a phone at any time. The iPhone can request signed revocation while Connector is
reachable; when it is offline, DevinX clearly offers local-only removal instead of pretending the Mac
grant was revoked. Closing the Connector window leaves its visible menu-bar service running. **Quit
DevinX Connector** stops the bridge. Launch at login is an explicit user choice.

## Security and privacy

- Cloud service-user credentials stay in iOS Keychain using device-only protection.
- Computer credentials remain on the computer and are never copied to the phone.
- Connector identity, TLS material, and device grants stay in macOS Keychain.
- Every protected Connector request is device-authenticated, authorized server-side, replay checked,
  and rate limited; unauthorized resource access uses generic non-disclosing errors.
- API and bridge payloads are parsed through Zod boundaries.
- Raw voice audio is processed on device, never sent over the network, and not retained after
  transcription.
- Session content, transcripts, keys, and QR payloads are excluded from analytics and logs.
- Disconnect wipes the phone's Keychain credentials, protected caches, drafts, templates, and
  remembered session context.
- DevinX ships no crash-reporting or product-analytics SDK in v1.

Read [PRIVACY.md](PRIVACY.md) for data handling and [SECURITY.md](SECURITY.md) for private
vulnerability reporting. Never post credentials, QR payloads, private session content, or working
exploit details in a public issue.

## Supported boundaries

- Cloud features depend on the authenticated Devin account, organization tier, and documented API
  permissions. DevinX shows an honest unavailable/permission state when a capability is not exposed.
- Security Work lists only genuine top-level sessions whose canonical origin is `code_scan`; it is not
  Cognition's enterprise findings dashboard and does not invent a scan-creation endpoint.
- Computer models and workspaces come from the live local ACP catalog. DevinX preserves exact model
  identifiers when dispatching work.
- Same-Wi-Fi transport, shared server passwords, browser-cookie reuse, and service-account
  impersonation are outside the supported architecture.
- iPad, Android, Windows Connector, and Linux Connector support are not part of the initial release.

## Development

### Requirements

- Node.js `24.18.0` (exact version in `package.json`)
- Xcode and CocoaPods for iOS native builds
- A supported Expo/EAS environment for development builds

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Native voice, camera, Keychain, and other modules require a native development/TestFlight build;
Expo Go is not the release test environment. Do not add secrets to `.env`, source files, commands,
logs, screenshots, or client bundles.

### Common scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint with zero warnings |
| `npm run typecheck` | Strict TypeScript check |
| `npm run test` | Jest with open-handle detection |
| `npm run build` | App and bridge TypeScript release gate |
| `npm run audit` | High/critical dependency gate |
| `npm run connector:build:macos` | Build the local macOS development artifact |
| `npm run connector:verify:macos` | Verify the packaged Connector artifact |

Dependencies are exact-pinned. New packages must be verified against the official registry,
publication history, download history, and source repository before installation.

## Architecture

```text
src/app/                 Expo Router screens
src/components/          UI components without direct API ownership
src/api/devin/           Cloud client, endpoint contracts, Zod schemas
src/auth/                Keychain credentials and connection providers
src/lib/                 Product rules, diagnostics, voice, polling, utilities
src/cache/               Protected SQLite read cache
bridge/                  Authenticated local Connector service
connector/macos/         Native macOS application
specs/                   Product and security source of truth
docs/                    Setup, threat model, parity, and release evidence
tests/                   Unit, integration, security, and UI contract tests
```

Start with [specs/000-build-spec.md](specs/000-build-spec.md),
[docs/devinx-connector.md](docs/devinx-connector.md), and
[docs/authorization-matrix.md](docs/authorization-matrix.md). Project instructions live in
[AGENTS.md](AGENTS.md).

## Contributing and releases

The specification is the source of truth. Change the spec before changing a supported product
boundary. Every release must pass lint, strict TypeScript, tests, app/Connector builds, dependency
audit, secret scan, authorization/IDOR review, packaged-artifact verification, and the applicable
physical-device checklist.

An internal TestFlight upload, screenshot package, or signed Connector artifact is not permission to
submit App Review or publish another release. Public actions require separate explicit owner approval.

## License

Original DevinX software and documentation are available under the [MIT License](LICENSE). See
[NOTICE](NOTICE) for third-party dependencies, names, logos, screenshots, reference material, and
trademark boundaries.
