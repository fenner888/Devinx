# 037 — DevinX Connector for Windows

Status: active release implementation. Windows is an in-scope Local target, not a deferred “coming soon” item. It becomes a supported public download only after every release gate below passes on physical Windows hardware.

## Product decision

DevinX calls the user-controlled execution path **Local**. Local may be a Mac today and a Windows PC after this specification is complete. Existing internal identifiers such as the `computer` connection mode, Keychain keys, URL routes, and persisted record names remain unchanged for backward compatibility.

Windows uses the same DevinX Connector trust model and mobile protocol as macOS. It is not a second bridge, a shared-password server, a browser wrapper, or a DevinX-operated relay. Tailscale supplies the private route; Connector supplies the authenticated local service, device grants, replay protection, and the bounded Devin ACP adapter.

## Mandatory capability checkpoint

Official Cognition documentation now provides native Devin CLI installers for Windows x64 and
arm64, names PowerShell, Windows Terminal, and Git Bash as supported launch environments, and
documents `devin acp` as a JSON-RPC-over-stdio subprocess for ACP-aware clients:

- [Devin CLI quickstart](https://docs.devin.ai/cli/index)
- [Terminal compatibility](https://docs.devin.ai/cli/reference/terminal-compatibility)
- [`devin acp` client behavior](https://docs.devin.ai/cli/acp/zed)

This confirms that the shared Connector architecture has a supported local Windows runtime. It does
not remove runtime capability negotiation: every installed CLI version remains authoritative for
the exact methods it advertises. Before a Windows release can be called functional, the installed
official Devin CLI on the test PC must expose the ACP capabilities consumed by Connector. Connector
therefore:

- discovers only an allowlisted executable available through the signed-in user's Windows `Path`;
- executes no shell profile and never guesses a third-party package or download;
- negotiates ACP capabilities at runtime and fails closed when required methods are unavailable; and
- shows a clear **Devin for Terminal is unavailable on this Windows PC** state without opening a listener that claims session support.

No fallback may scrape credentials, automate the Devin web application, run arbitrary shell commands, or impersonate a user account.

The separately documented [Windows cloud-session
environment](https://docs.devin.ai/onboard-devin/environment/windows-support) is not used as
evidence for Local Connector behavior; it remains a different product path.

## Architecture

The platform-neutral TypeScript controller, bridge authorization, pairing protocol, strict Zod schemas, ACP adapter, rate limits, generic unauthorized `404` behavior, and iPhone client remain shared.

The Windows adapter owns only:

- current-user DPAPI protection and the user-owned encrypted state file;
- Windows `Path` executable discovery;
- a native per-user control window and notification-area lifecycle;
- explicit launch-at-sign-in registration through the packaged Windows startup-task API, with a
  current-user registry fallback only for separately gated unpackaged development builds;
- Store packaging, update awareness, diagnostics, and uninstall, plus Authenticode signing only
  for any separately released direct-download package; and
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
- Launch at sign-in is opt-in and visible. The Store package uses the manifest-declared
  `DevinXConnectorStartup` task and `Windows.ApplicationModel.StartupTask`; unpackaged development
  builds may use an allowlisted current-user startup registration. Neither path may create a
  system service or machine-wide task, and Connector must respect a user-disabled startup task.
- The window presents connection health, short-lived QR, pending phone approval, separate read/send/create grants, paired-device revocation, code regeneration, update awareness, and reset/uninstall guidance.
- Paired devices are ordered with the most recently paired device first.

## Packaging and update boundary

The first supported package is Windows 11 x64. Windows 10 and Windows arm64 remain unsupported until separately tested and named in the compatibility matrix. The app and helper are self-contained. A public artifact requires:

- a Microsoft Store MSIX whose package identity exactly matches the Partner Center reservation;
- Microsoft Store signing and delivery for the public Store package;
- a published adjacent SHA-256 checksum and provenance record;
- the MIT license in both the installed application and distribution artifact;
- Store-managed updates and deterministic per-user uninstall that deletes only DevinX Connector
  state; and
- a separately gated direct-download installer only when every owned executable and installer has
  a verified Authenticode signature controlled by the DevinX publisher.

The Store identity is public packaging metadata, not a secret:

- identity name: `DevinXTools.DevinXConnector`
- publisher: `CN=43D84E24-857C-4C40-9DAA-1A6983913CD9`
- publisher display name: `DevinX Tools`
- Store ID: `9N52Z3FVMFH8`
- package family: `DevinXTools.DevinXConnector_ydtgrt4yd5wrc`
- default package language: `en-US`

The committed Store identity file is the source of truth for manifest rendering. CI must reject any
manifest or artifact whose name, publisher, architecture, version, language, logo assets, normalized
packaged executable name (`DevinXConnector.exe`), or startup-task declaration drifts from it. The
MSIX submitted to Partner Center is intentionally unsigned before upload;
Microsoft signs the accepted Store package. It must never be offered as a direct-download build.

Unsigned EXE/ZIP CI artifacts remain verification artifacts only. The mobile assisted setup prompt
must ignore them and must stop when no Store-signed or Authenticode-signed Windows release exists.
Product copy must describe Windows as an active release target without offering an unsigned artifact
or promising that an unavailable package works.

## Acceptance gates

Automated:

- strict TypeScript and Windows native builds on a pinned Windows CI image;
- fail-closed Authenticode signing and verification for any separately released direct-download
  application, DPAPI helper, and per-user installer; ordinary CI artifacts remain non-release;
- DPAPI set/get/delete, not-found, size-limit, malformed-input, and wrong-user failure tests;
- in-memory .NET TLS identity generation, cryptographic key/certificate matching, bounded helper
  output, and encrypted persistence without an OpenSSL installation;
- platform discovery tests covering `Path`, invalid/relative entries, absent ACP, and no shell execution;
- shared pairing, authorization, rate-limit, replay, grant, revoke, endpoint-refresh, and generic-404 suites;
- package contents, installer registration/uninstall lifecycle, MIT license, pinned runtime
  checksum, secret scan, dependency audit, and artifact checksum verification; and
- exact Partner Center identity rendering, MSIX schema validation, Store asset dimensions,
  `runFullTrust`, Windows 11 targeting, and an opt-in packaged startup task; and
- mobile copy tests proving **Local** does not change persisted `computer` identifiers.

Physical Windows 11 x64:

- clean standard-user install, SmartScreen/signature presentation, first launch, Tailscale detection, and ACP capability negotiation;
- QR scan, approve/deny/expiry, read/send/create grant separation, AskUserQuestion response, session create/load/continue, endpoint refresh, and revoke from both sides;
- window close versus explicit Quit, launch at sign-in, reboot, sleep/wake, Tailscale reconnect, repair, update, and uninstall;
- locked-screen and second-Windows-user isolation; and
- confirmation that Connector never binds to LAN, wildcard, or public interfaces.

Until those physical gates pass, the iPhone UI must not use **coming soon** copy or offer a Windows download as working functionality. The signed-release lookup may report that a verified Windows package is not yet available and provide recovery guidance. Once the gates pass, Windows 11 x64 is presented alongside macOS as a supported Local platform.
