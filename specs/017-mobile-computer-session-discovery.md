# 017 — Mobile Computer session discovery

Status: implemented and automated-test validated; Tailscale HTTP was exercised from an iOS Simulator against the real macOS Connector, while physical-iPhone validation remains pending. Spec 020 supersedes this document's HTTPS-only transport wording for Tailscale.

## Scope

This phase connects the paired-computer credential to the authenticated Desktop Bridge request route and renders read-only local session metadata in the existing mobile Home and Sessions screens. It does not enable session content, session loading, prompts, permission responses, or any other steering operation.

## Authenticated request boundary

Every discovery cycle opens its selected Mac connections from one fresh, validated Secure Store registry read. Each request within that short-lived cycle:

1. checks the validated server-issued grant locally as an early failure, without treating that client check as authorization;
2. asks the native iOS security module for a fresh UUID request ID and 24 cryptographically random nonce bytes;
3. builds a Zod-strict protocol-v1 envelope with a 15-second lifetime;
4. canonicalizes and signs the complete unsigned envelope using the device's Ed25519 private key in iOS Keychain;
5. sends it only to the credential's canonical private-network endpoint through the existing leaf-certificate-pinned native HTTPS route; and
6. parses the status and method-specific response through strict Zod schemas before returning data to a query or component.

The server still performs the authoritative device, bridge, signature, expiry, replay, permission, and optional session-scope checks. Missing/revoked credentials and grants use generic errors and do not expose resource existence. Remote error bodies and native transport details are not passed into UI state or messages.

Cloud credentials are never read by the Computer client. Bridge endpoints, TLS pins, signing-key IDs, public-key pins, and raw credential records remain in `src/auth` and do not enter React state.

## Health and discovery flow

Each foreground discovery cycle first requests authenticated `bridge.health` for every paired Mac selected by Computer or Cloud + Computer mode. `session.list` is sent only when the bridge advertises that capability.

Discovery is bounded to:

- eight paired computers from the credential registry;
- five pages per computer;
- 5,000 sessions per computer;
- unique session handles and non-repeating cursors; and
- one 30-second foreground refresh cadence, plus focus/reconnect refresh.

A five-page response that still has a continuation cursor produces the `too_many_sessions` state and fails that computer closed: no partial pages or previous sessions are shown. The page bound and paging behavior are unchanged. A malformed sequence also fails that computer closed. An unavailable Mac does not hide valid results from another paired Mac. Computer session query data is memory-only in TanStack Query and is not written into the Cloud SQLite cache or AsyncStorage.

Busy or rate-limited discovery keeps that Mac's last session list and shows an explicit busy notice, distinct from the offline notice. A `too_many_sessions` notice says: “{computerName} has more sessions than DevinX can list right now, so none are shown.”

The Sessions screen freshness line is “Local list updated {relative time} · refreshes every 30s”. `lastSuccessfulAt` advances only when every paired computer is `ready` or `session_discovery_off`; otherwise it preserves the previous successful timestamp. An empty computer registry has no timestamp. The line re-renders every 15 seconds so the relative time stays current without changing the existing “just now” wording.

In Computer-only mode, if there are no unfiltered sessions, at least one paired computer exists, and every computer is non-ready, the empty state is titled “Local sessions unavailable” with “Fix the connection above, then pull down to refresh.” When a local-only search has no matches, its empty copy is “No sessions match your search.” Cloud search retains “No sessions match your search or tag filters.”

## Privacy-preserving presentation

Default pairing grants `session:metadata:read`, not `session:content:read`. The mobile row therefore accepts and displays only:

- the `local_` opaque handle;
- the sanitized workspace basename;
- whether a title exists, without its value;
- optional update time; and
- the locally assigned Mac name.

The row says **Session title hidden** when the bridge reports title presence without title content. A title is rendered only if a future explicit content grant causes the validated bridge response to include it. Non-compact session rows can display a title on two lines; compact rows remain one line. On the Sessions screen, a single paired Mac's visible row omits the computer name and its separator, while the accessibility label still includes “on {computerName}”; with multiple Macs, the visible computer name remains. Home row usage is unchanged. Raw ACP session IDs, full paths, extra directories, `_meta`, and unknown fields never reach the component.

Computer-only Home disables the Cloud composer and explains that a new local task starts from Devin CLI or desktop. In Cloud + Computer mode, Home Recent follows the active composer destination: Cloud shows Cloud sessions and Computer shows sessions from the selected Mac. The full Sessions screen remains the combined cross-origin view and searches Mac name, workspace, and an authorized title; Cloud tag filters do not pretend that local sessions have Cloud tags. Spec 032 supersedes the earlier merged Home Recent behavior.

When a local session detail screen is available under its existing authorization gate, its header prefers the title from the cached session-list item. If that cached title is used, the workspace name appears directly below it as a subtitle, preferring the loaded session detail and falling back to the cached list item. Without a cached list title, the header falls back to the loaded workspace name or “Local session” and does not show a workspace subtitle.

## Validation

Automated coverage includes:

- native request-identity result validation;
- complete canonical envelope fields, lifetime, pinned route, and local grant checks;
- real mobile-signature interoperability with the server authorization implementation;
- strict health and session-page response parsing;
- server-status minimization and malformed-response rejection;
- multi-Mac health, pagination, sorting, partial availability, repeated-cursor, and duplicate-handle behavior;
- privacy-redacted local session rows and degraded-state notices;
- Computer-only Home and Sessions presentation; and
- Cloud composer and archive regressions.

The native module and complete generic physical-iPhone target compile with code signing disabled. The real pairing checkpoint must still pass before this phase can be validated over an actual private network. The first ACP-enabled device test must confirm that a title remains hidden under the default metadata grant.
