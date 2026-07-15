# Phase 3C — Mobile Connection Modes

Status: implemented. The mode model, onboarding choice, secure paired-computer registry, Tailscale-only iOS networking, pairing and desktop approval, privacy-minimized discovery/loading, separately authorized steering, and per-computer removal are present. Spec 020 supersedes this document's earlier multi-transport language; spec 023 defines steering.

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
- canonical Tailscale `100.64.0.0/10` HTTP endpoint;
- pinned bridge public key and fingerprint;
- per-device public key and opaque ID for the private signing key held in iOS Keychain;
- server-approved grants; and
- pairing timestamp.

React context receives summaries only. Device private keys, bridge keys, endpoints, and raw credential JSON never enter UI state.

## Disconnect behavior

- Disconnect Cloud: wipes only Cloud key, org, attribution, and auth-kind values.
- Remove a computer: requires confirmed requesting-device revocation on the Connector before erasing that computer's phone credential and signing key. If the computer is offline, the credential remains so revocation can be retried safely.
- Disconnect and wipe all: wipes Cloud and paired-computer credentials, cached sessions/messages, and query state.
- Web preview credentials are memory-only and never use localStorage.

## Current UI boundary

Computer onboarding and Settings both reach the same in-app QR pairing flow. A Cloud-only user who adds a Mac moves to Cloud + Computer mode after the credential is securely stored. The camera starts only after an explicit Scan action and permission grant; cancel, background, scan completion, and view removal stop capture.

Computer and Cloud + Computer modes issue signed, authenticated health requests and list local sessions only when the Connector advertises authorized discovery. Home and the full Sessions screen render local rows with an explicit Mac name and collision-proof `local_` handle. Default metadata grants expose only workspace basename, title presence, and update time; the UI labels a withheld title instead of inventing or leaking it. Computer-only mode does not present its disabled Cloud composer as a working local-session creator.

## Remaining acceptance gates

- Physically revalidate all three modes, per-computer removal, and steering in the release-candidate build.
- Validate cold start, corrupt Secure Store, revoked device, offline computer, Cloud-only regression, and combined mode on real iPhone hardware.
