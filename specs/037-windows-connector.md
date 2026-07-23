# 037 — DevinX Connector for Windows

Status: approved implementation phase; shared adapter and packaging foundation may ship to CI, but Windows must not be advertised as supported until every release gate below passes on physical Windows hardware.

## Product decision

DevinX calls the user-controlled execution path **Local**. Local may be a Mac today and a Windows PC after this specification is complete. Existing internal identifiers such as the `computer` connection mode, Keychain keys, URL routes, and persisted record names remain unchanged for backward compatibility.

Windows uses the same DevinX Connector trust model and mobile protocol as macOS. It is not a second bridge, a shared-password server, a browser wrapper, or a DevinX-operated relay. Tailscale supplies the private route; Connector supplies the authenticated local service, device grants, replay protection, and the bounded Devin ACP adapter.

## Mandatory capability checkpoint

Before a Windows release can be called functional, the official Devin for Terminal installation on the test PC must expose the ACP capabilities consumed by Connector. The public Devin Windows-environment documentation describes cloud session environments and is not evidence that local Devin for Terminal supports Windows. Connector therefore:

- discovers only an allowlisted executable available through the signed-in user's Windows `Path`;
- executes no shell profile and never guesses a third-party package or download;
- negotiates ACP capabilities at runtime and fails closed when required methods are unavailable; and
- shows a clear **Devin for Terminal is unavailable on this Windows PC** state without opening a listener that claims session support.

No fallback may scrape credentials, automate the Devin web application, run arbitrary shell commands, or impersonate a user account.

## Architecture

The platform-neutral TypeScript controller, bridge authorization, pairing protocol, strict Zod schemas, ACP adapter, rate limits, generic unauthorized `404` behavior, and iPhone client remain shared.

The Windows adapter owns only:

- current-user DPAPI protection and the user-owned encrypted state file;
- Windows `Path` executable discovery;
- a native per-user control window and notification-area lifecycle;
- explicit launch-at-sign-in registration;
- packaging, Authenticode signing, update awareness, diagnostics, and uninstall; and
- Windows Firewall guidance for the exact active Tailscale interface.

The Windows shell launches the bundled, checksum-verified Node runtime as a child with redirected standard input/output. The existing bounded newline-delimited IPC protocol is the only native-to-runtime channel. QR payloads stay in memory and are rendered only in the native window.

## Secure storage

Connector state is encrypted with Windows DPAPI using `CRYPTPROTECT_UI_FORBIDDEN` and current-user scope. The encrypted blob lives under the signed-in user's local application-data directory in a dedicated DevinX Connector folder. Writes are bounded, atomic, and replace the prior encrypted blob only after encryption succeeds. The helper:

- accepts only `get`, `set`, and `delete` operations;
- receives plaintext only through a redirected standard-input pipe;
- never places plaintext or protected blobs in command-line arguments, logs, environment variables, clipboard, registry values, or crash messages;
- applies a fixed application entropy value and zeroes plaintext buffers after use;
- returns a distinct not-found exit code; and
- fails closed on decryption, file-permission, or identity errors.

## Lifecycle and UI

- Normal operation is per-user and requires no administrator privilege or Windows service.
- Closing the control window keeps Connector available through a visible notification-area icon.
- **Quit DevinX Connector** explicitly stops the child runtime and listener.
- Launch at sign-in is opt-in and visible. It may use an allowlisted current-user startup registration; it may not create a system service or machine-wide task.
- The window presents connection health, short-lived QR, pending phone approval, separate read/send/create grants, paired-device revocation, code regeneration, update awareness, and reset/uninstall guidance.
- Paired devices are ordered with the most recently paired device first.

## Packaging and update boundary

The first supported package is Windows 11 x64. Windows 10 and Windows arm64 remain unsupported until separately tested and named in the compatibility matrix. The app and helper are self-contained. A public artifact requires:

- an Authenticode code-signing certificate controlled by the DevinX publisher;
- signature verification on every owned executable and installer;
- a published adjacent SHA-256 checksum and provenance record;
- the MIT license in both the installed application and distribution artifact;
- explicit user-approved update/replacement with no silent installer; and
- deterministic per-user uninstall that stops Connector and deletes only DevinX Connector state.

Unsigned CI artifacts are verification artifacts only. The mobile assisted setup prompt must ignore them and must stop when no signed Windows release exists.

## Acceptance gates

Automated:

- strict TypeScript and Windows native builds on a pinned Windows CI image;
- DPAPI set/get/delete, not-found, size-limit, malformed-input, and wrong-user failure tests;
- platform discovery tests covering `Path`, invalid/relative entries, absent ACP, and no shell execution;
- shared pairing, authorization, rate-limit, replay, grant, revoke, endpoint-refresh, and generic-404 suites;
- package contents, MIT license, pinned runtime checksum, secret scan, dependency audit, and artifact checksum verification; and
- mobile copy tests proving **Local** does not change persisted `computer` identifiers.

Physical Windows 11 x64:

- clean standard-user install, SmartScreen/signature presentation, first launch, Tailscale detection, and ACP capability negotiation;
- QR scan, approve/deny/expiry, read/send/create grant separation, AskUserQuestion response, session create/load/continue, endpoint refresh, and revoke from both sides;
- window close versus explicit Quit, launch at sign-in, reboot, sleep/wake, Tailscale reconnect, repair, update, and uninstall;
- locked-screen and second-Windows-user isolation; and
- confirmation that Connector never binds to LAN, wildcard, or public interfaces.

Until those physical gates pass, the iPhone UI may describe Windows as **coming later** but must not offer a Windows download as working functionality.
