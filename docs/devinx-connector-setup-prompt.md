# AI-assisted DevinX Connector setup prompt

This is the primary assisted installation guide presented by DevinX after a user chooses **Local** or **Cloud + Local**. macOS uses the notarized release at <https://github.com/fenner888/Devinx/releases/latest>. Windows 11 x64 uses the reserved Microsoft Store listing at <https://apps.microsoft.com/detail/9N52Z3FVMFH8>. The prompt must stop safely unless the platform's official distribution and trust checks are available.

Cloud-only users do not need Connector. For Local access, Tailscale provides only the private network route; Connector is the required trusted local service that communicates with a supported local Devin ACP capability and authenticates each iPhone. A Tailscale IP or password is not a replacement for a compatible service running on the local device.

> Set up DevinX Connector on this local device so I can securely connect the DevinX iPhone app to supported local Devin sessions through Tailscale.
>
> Before downloading anything, explain that Tailscale supplies only the private network route. DevinX Connector is the trusted local service that communicates with Devin for Terminal, authenticates this iPhone, and enforces its permissions. A Tailscale IP, server URL, or password cannot replace a compatible service running on this computer. Cloud-only DevinX use does not require Connector.
>
> Detect whether this computer is macOS or Windows.
>
> On macOS, open https://github.com/fenner888/Devinx/releases/latest. Download Connector only when that page provides the signed Apple-silicon DMG plus its adjacent SHA-256 checksum. Verify the checksum, require a Developer ID Application signature, Apple notarization, and Gatekeeper acceptance.
>
> On Windows 11 x64, open https://apps.microsoft.com/detail/9N52Z3FVMFH8. Install only the Microsoft Store package named DevinX Connector, published by DevinX Tools, with Store ID 9N52Z3FVMFH8. After installation, confirm that Get-AppxPackage reports identity DevinXTools.DevinXConnector, publisher CN=43D84E24-857C-4C40-9DAA-1A6983913CD9, and package family DevinXTools.DevinXConnector_ydtgrt4yd5wrc. Do not download, sideload, or execute an unsigned CI MSIX, EXE, or ZIP.
>
> If the required official distribution is unavailable, or any applicable identity, signature, checksum, notarization, or Gatekeeper check fails, stop and tell me that DevinX Connector cannot be safely installed. Do not clone or build the source, install a guessed package, use an unofficial repository or mirror, or substitute a similarly named application.
>
> Confirm that an official local Devin installation exposes the ACP capability required by Connector. You may locate its executable, but do not read, copy, print, log, or modify its credentials. If the required ACP capability is unavailable on this operating system, stop instead of claiming Local sessions will work.
>
> Confirm that Tailscale is installed and connected on this computer. If authentication is required, open the official interactive login and let me complete it. Never request, generate, print, or persist a reusable Tailscale authentication key.
>
> Install DevinX Connector for the signed-in user and open it. On macOS, install it in /Applications. On Windows, use only the Microsoft Store package and do not create an administrator service. Do not run it as root or Administrator, bind it to `0.0.0.0`, expose a public listener, install a public tunnel, or weaken its QR pairing and per-device authorization. Do not enable launch at login without showing me the Connector's visible setting and receiving my approval.
>
> Verify that the connector reports a private Tailscale connection and detects a supported local Devin ACP capability. Then tell me to open DevinX on my iPhone and choose **Settings → Local devices → Add local device → Scan pairing code**.
>
> After I scan the code, leave device approval and every read, steering, or session-creation grant to the Connector UI on this computer. Do not approve any permission on my behalf. Once pairing is complete, explain that I may close the window while Connector remains available from the macOS menu-bar icon or Windows notification-area icon.
>
> Reply only with the connector status, whether Tailscale and a supported local Devin ACP capability were detected, and any remaining action I must complete. Do not print the QR payload, bridge endpoint, keys, tokens, credentials, or raw diagnostic logs.
