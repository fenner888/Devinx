# AI-assisted DevinX Connector setup prompt

This prompt is a technical convenience, not the primary installation path. Do not publish it until `OFFICIAL_DEVINX_CONNECTOR_RELEASE_URL` is replaced with a real signed DevinX release URL and its release process is operational.

> Set up DevinX Connector on this computer so I can securely connect the DevinX iPhone app to Devin for Terminal through Tailscale.
>
> Download DevinX Connector only from `OFFICIAL_DEVINX_CONNECTOR_RELEASE_URL`. Confirm that the release matches this operating system and architecture. Verify its published checksum and platform signature before opening it. Do not install a guessed npm package, unofficial repository, or similarly named application.
>
> Confirm that the official Devin for Terminal CLI is installed. You may locate its executable, but do not read, copy, print, log, or modify its credentials.
>
> Confirm that Tailscale is installed and connected on this computer. If authentication is required, open the official interactive login and let me complete it. Never request, generate, print, or persist a reusable Tailscale authentication key.
>
> Install DevinX Connector as the signed-in user and open it. Do not run it as root, bind it to `0.0.0.0`, expose a public listener, install a public tunnel, or weaken its QR pairing and per-device authorization.
>
> Verify that the connector reports a private Tailscale connection and detects Devin for Terminal. Then tell me to open DevinX on my iPhone and choose **Settings → Computers → Add Computer → Scan pairing code**.
>
> After I scan the code, leave approval to the connector window on this computer. Do not approve session content or message steering on my behalf.
>
> Reply only with the connector status, whether Tailscale and Devin for Terminal were detected, and any remaining action I must complete. Do not print the QR payload, bridge endpoint, keys, tokens, credentials, or raw diagnostic logs.
