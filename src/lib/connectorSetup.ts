import { branding } from './branding';

export const CONNECTOR_RELEASE_PAGE = branding.links.connectorReleases;
export const WINDOWS_CONNECTOR_STORE_PAGE = branding.links.windowsConnectorStore;

export const CONNECTOR_SETUP_PROMPT = `Set up DevinX Connector on this local device so I can securely connect the DevinX iPhone app to supported local Devin sessions through Tailscale.

Before downloading anything, explain that Tailscale supplies only the private network route. DevinX Connector is the trusted local service that communicates with a supported local Devin ACP capability, authenticates this iPhone, and enforces its permissions. A Tailscale IP, server URL, or password cannot replace a compatible service running on this local device. Cloud-only DevinX use does not require Connector.

Detect whether this local device is running macOS or Windows.

On macOS, open the official DevinX release page at ${CONNECTOR_RELEASE_PAGE}. Download Connector only when that page provides the signed Apple-silicon DMG plus its adjacent SHA-256 checksum. Verify the checksum, require a Developer ID Application signature, confirm Apple notarization, and require Gatekeeper acceptance.

On Windows 11 x64, open the official Microsoft Store listing at ${WINDOWS_CONNECTOR_STORE_PAGE}. Install only the Store package named DevinX Connector, published by DevinX Tools, with Store ID 9N52Z3FVMFH8. After installation, confirm that Get-AppxPackage reports package identity DevinXTools.DevinXConnector, publisher CN=43D84E24-857C-4C40-9DAA-1A6983913CD9, and package family DevinXTools.DevinXConnector_ydtgrt4yd5wrc. Do not download, sideload, or execute an unsigned CI MSIX, EXE, or ZIP.

If the required official distribution is unavailable for this platform, or any identity, signature, checksum, notarization, or Gatekeeper check applicable to it fails, stop and tell me that DevinX Connector cannot be safely installed. Do not clone or build the source, install a guessed package, use an unofficial repository or mirror, or substitute a similarly named application.

Confirm that an official local Devin installation exposes the ACP capability required by Connector. You may locate its executable, but do not read, copy, print, log, or modify its credentials. If the required ACP capability is unavailable on this operating system, stop instead of claiming local sessions will work.

Confirm that Tailscale is installed and connected on this local device. If it is missing, use only Tailscale's official installation guidance for the detected operating system. If authentication is required, open the official interactive login and let me complete it. Never request, generate, print, or persist a reusable Tailscale authentication key.

Install DevinX Connector for the signed-in user and open it. On macOS, install it in /Applications. On Windows, use only the Microsoft Store package and do not create an administrator service. Do not run it as root or Administrator, bind it to 0.0.0.0, expose a public listener, install a public tunnel, or weaken its QR pairing and per-device authorization. Do not enable launch at login without showing me the Connector's visible setting and receiving my approval.

Verify that Connector reports an active private Tailscale connection and detects a supported local Devin ACP capability. Then tell me to return to DevinX on my iPhone, name this local device, and tap Scan pairing code.

After I scan the code, leave device approval and every read, steering, or session-creation grant to the Connector UI on this local device. Do not approve any permission on my behalf. Once pairing is complete, explain that I may close the window while Connector remains available from its macOS menu-bar icon or Windows notification-area icon.

Reply only with Connector status, whether Tailscale and a supported local Devin ACP capability were detected, and any remaining action I must complete. Do not print the QR payload, bridge endpoint, keys, tokens, credentials, or raw diagnostic logs.`;
