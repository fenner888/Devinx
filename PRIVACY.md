# DevinX Privacy Policy

Effective: July 11, 2026

DevinX is an independent, unofficial client for the Devin API. It is not affiliated with, endorsed by, or a product of Cognition AI.

## Data processed

When you use Devin Cloud, DevinX sends the credentials, prompts, attachments, and session actions you provide directly to the Devin API at `api.devin.ai` over encrypted HTTPS. Cognition's handling of that data is governed by its terms and privacy policies.

DevinX stores the following on your device:

- Devin API credentials and organization identifiers in the operating-system Keychain or secure credential store
- app preferences, selected repositories, and session display context in local app storage
- a read cache of cloud session metadata for offline access
- per-device Connector credentials in the operating-system Keychain when you pair a computer

Disconnecting and wiping connections removes stored credentials, cached cloud session data, and in-memory query data from the device.

## Analytics, crash reports, and notifications

DevinX does not currently enable a product analytics SDK. Session titles, prompts, messages, repository names, source code, and attachments are not sent to an analytics provider.

The current production configuration does not provide a Sentry DSN, so crash reports are not transmitted. If crash reporting is enabled in a future release, DevinX will update this policy and its App Store privacy disclosures before release; its existing scrubber removes authorization headers, API-key-like strings, organization identifiers, credential-bearing URLs, and session message content.

The current release does not register the iPhone for remote push notifications and does not transmit an Expo push token.

## Paired-computer access

When you explicitly enable Computer Connection, DevinX can connect directly to DevinX Connector running on a computer you control. Version 1 uses a private Tailscale network. Pairing requires a short-lived QR code, explicit approval on the computer, and a unique iPhone signing key. Every subsequent request is signed, authenticated, replay-protected, rate-limited, input-validated, and authorized by the computer.

The default grant exposes minimized session metadata. Separate per-device permissions can allow bounded user/Devin message history and sending text to a previously discovered session. Sending is never implied by read permission and can be removed independently. The Connector does not return raw local session identifiers, full filesystem paths, other directories, agent thoughts, tool inputs or outputs, commands, local files, API credentials, or unknown ACP metadata. Tool approvals, file access, attachments, session creation, archive, termination, and arbitrary ACP actions are not supported by these grants.

Local-session responses remain only in the app's in-memory query cache and are removed during normal cache collection or when connections are wiped.

## Tailscale transport

Tailscale provides private network reachability between your iPhone and computer; DevinX still verifies and authorizes every request independently. Session traffic travels between those devices, not through a DevinX-operated relay. Use of Tailscale is governed by Tailscale's privacy policy and your account settings.

## App delivery

The installed app may contact Expo over encrypted TLS to check for a compatible DevinX update. Update requests do not include Devin credentials, prompts, messages, repository names, attachments, local-session content, or Connector pairing secrets. Expo's handling of update-service transport data is governed by its privacy terms.

## Your controls and deletion

You can disconnect a cloud or computer connection from DevinX to remove its credentials and local cache from the iPhone. You can revoke an iPhone from DevinX Connector to end that device's access to the Mac. Removing local DevinX data does not delete sessions or account data retained by Cognition; use the controls provided by the Devin service or contact Cognition for those requests.

Camera and photo-library access are requested only when you choose the related scanner or attachment feature. You can deny or later revoke those permissions in iOS Settings. DevinX does not capture a photo or video while scanning a Connector QR code.

## Data sharing and sale

DevinX does not sell personal data, use data for advertising, or track users across other companies' apps and websites. It does not operate an intermediary server for session traffic. Data is shared only with services required for features you invoke or app delivery: the Devin API, an explicitly paired computer, Tailscale for private-network transport, Expo for compatible app updates, and, only if disclosed and configured in a future release, a scrubbed crash-reporting service.

## Contact

For support or privacy questions, open an issue at `https://github.com/fenner888/Devinx/issues`.
