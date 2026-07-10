# Phase 3C — Mobile Connection Modes

Status: mode model, onboarding choice, secure paired-computer registry, pinned iOS transport, pairing and desktop approval, and privacy-minimized local session discovery are implemented. Local session loading, steering, and per-computer removal remain pending.

## Supported modes

| Mode             | Configuration requirement                                         | Session sources                                 |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Cloud            | Valid Devin Cloud credential in iOS Keychain                      | Devin API                                       |
| Computer         | At least one validated paired-computer credential in iOS Keychain | Desktop Bridge only                             |
| Cloud + Computer | Both requirements above                                           | Unified UI with explicit origin/computer labels |

The selected mode is a non-sensitive UI preference and may be stored in AsyncStorage. Cloud API credentials, device private keys, bridge public-key pins, pairing receipts, and endpoint records are secret/security-sensitive and remain under `src/auth` in Secure Store.

## Routing rules

- Existing users migrate to Cloud mode by default, preserving current behavior.
- The root route waits for Cloud Keychain state, paired-computer Keychain state, and preference hydration before redirecting.
- A mode is considered configured only when all of its required credential types exist and validate.
- Cloud queries remain disabled unless the Cloud auth provider is present.
- Computer-only mode never creates a placeholder Cloud provider and never asks for a Devin API key.
- Combined onboarding validates Cloud first, then continues to computer pairing.
- Push-token registration is enabled only when the selected mode uses Cloud and Cloud credentials exist.

## Paired-computer mobile record

The Secure Store boundary validates every record with Zod and caps the registry at eight computers. Each record contains:

- bridge and device IDs;
- user-facing computer name;
- canonical private-network HTTPS endpoint and pinned TLS certificate fingerprint;
- pinned bridge public key and fingerprint;
- per-device public key and opaque ID for the private signing key held in iOS Keychain;
- server-approved grants; and
- pairing timestamp.

React context receives summaries only. Device private keys, bridge keys, endpoints, and raw credential JSON never enter UI state.

## Disconnect behavior

- Disconnect Cloud: wipes only Cloud key, org, attribution, and auth-kind values.
- Remove a computer: will wipe that device credential after server-side revocation is attempted; implementation waits for transport.
- Disconnect and wipe all: wipes Cloud and paired-computer credentials, cached sessions/messages, and query state.
- Web preview credentials are memory-only and never use localStorage.

## Current UI boundary

Computer onboarding and Settings both reach the same in-app QR pairing flow. A Cloud-only user who adds a Mac moves to Cloud + Computer mode after the credential is securely stored. The camera starts only after an explicit Scan action and permission grant; cancel, background, scan completion, and view removal stop capture.

Computer and Cloud + Computer modes issue signed, pinned health requests and list local sessions only when the bridge advertises read-only discovery. Home and the full Sessions screen render local rows with an explicit Mac name and collision-proof `local_` handle. Default metadata grants expose only workspace basename, title presence, and update time; the UI labels a withheld title instead of inventing or leaking it. Computer-only mode does not present its disabled Cloud composer as a working local-session creator.

## Remaining acceptance gates

- Add per-computer revocation/removal and complete mode switching without trapping a configured user.
- Add separately authorized local session loading and steering; keep local discovery rows non-interactive until then.
- Validate cold start, corrupt Secure Store, revoked device, offline computer, Cloud-only regression, and combined mode on real iPhone hardware.
