# AI-assisted DevinX Connector setup prompt

This is the primary assisted installation guide presented by DevinX after a user chooses **Computer** or **Cloud + Computer**. The official release page is <https://github.com/fenner888/Devinx/releases/latest>. Until that page contains a Developer ID-signed, Apple-notarized Connector DMG and its adjacent SHA-256 file, the prompt must stop safely instead of installing a development artifact.

Cloud-only users do not need Connector. For computer access, Tailscale provides only the private network route; Connector is the required trusted local service that communicates with Devin for Terminal and authenticates each iPhone. A Tailscale IP or password is not a replacement for a compatible service running on the computer.

> Set up DevinX Connector on this computer so I can securely connect the DevinX iPhone app to Devin for Terminal through Tailscale.
>
> Before downloading anything, explain that Tailscale supplies only the private network route. DevinX Connector is the trusted local service that communicates with Devin for Terminal, authenticates this iPhone, and enforces its permissions. A Tailscale IP, server URL, or password cannot replace a compatible service running on this computer. Cloud-only DevinX use does not require Connector.
>
> Open the official DevinX release page at https://github.com/fenner888/Devinx/releases/latest. Download DevinX Connector only when that official release provides a macOS DMG for this Mac's architecture and an adjacent SHA-256 checksum file. If no signed release is available, stop and tell me that DevinX Connector has not been published yet. Do not clone or build the source, install a guessed npm package, use an unofficial repository or mirror, or substitute a similarly named application.
>
> Verify the downloaded DMG against the published SHA-256 value. Then verify with macOS that the app is signed with a Developer ID Application certificate, notarized by Apple, and passes Gatekeeper before opening it. Stop if any verification is missing or fails.
>
> Confirm that the official Devin for Terminal CLI is installed. You may locate its executable, but do not read, copy, print, log, or modify its credentials.
>
> Confirm that Tailscale is installed and connected on this computer. If authentication is required, open the official interactive login and let me complete it. Never request, generate, print, or persist a reusable Tailscale authentication key.
>
> Install DevinX Connector in /Applications as the signed-in user and open it. Do not run it as root, bind it to `0.0.0.0`, expose a public listener, install a public tunnel, or weaken its QR pairing and per-device authorization. Do not enable launch at login without showing me the Connector's visible setting and receiving my approval.
>
> Verify that the connector reports a private Tailscale connection and detects Devin for Terminal. Then tell me to open DevinX on my iPhone and choose **Settings → Computers → Add Computer → Scan pairing code**.
>
> After I scan the code, leave device approval and every read, steering, or session-creation grant to the Connector UI on this computer. Do not approve any permission on my behalf. Once pairing is complete, explain that I may close the window while the Connector remains available from its menu-bar icon.
>
> Reply only with the connector status, whether Tailscale and Devin for Terminal were detected, and any remaining action I must complete. Do not print the QR payload, bridge endpoint, keys, tokens, credentials, or raw diagnostic logs.
