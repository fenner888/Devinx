# DevinX Privacy Policy

Effective: July 10, 2026

DevinX is an independent, unofficial client for the Devin API. It is not affiliated with, endorsed by, or a product of Cognition AI.

## Data processed

When you use Devin Cloud, DevinX sends the credentials, prompts, attachments, and session actions you provide directly to the Devin API at `api.devin.ai` over encrypted HTTPS. Cognition's handling of that data is governed by its terms and privacy policies.

DevinX stores the following on your device:

- Devin API credentials and organization identifiers in the operating-system Keychain or secure credential store
- app preferences, selected repositories, and session display context in local app storage
- a read cache of cloud session metadata for offline access
- per-device Connector credentials in the operating-system Keychain when you pair a computer

Disconnecting and wiping connections removes stored credentials, cached cloud session data, and in-memory query data from the device.

## Analytics and crash reports

DevinX does not currently enable a product analytics SDK. Session titles, prompts, messages, repository names, source code, and attachments are not sent to an analytics provider.

Production builds may use Sentry for crash diagnostics. Before a report is sent, DevinX removes authorization headers, API-key-like strings, organization identifiers, credential-bearing URLs, and session message content. Crash reporting is disabled when no Sentry DSN is configured.

## Paired-computer access

When you explicitly enable Computer Connection, DevinX can connect directly to DevinX Connector running on a computer you control. Version 1 uses a private Tailscale network. Pairing requires a short-lived QR code, explicit approval on the computer, and a unique iPhone signing key. Every subsequent request is signed, authenticated, replay-protected, rate-limited, input-validated, and authorized by the computer.

The default grant exposes minimized session metadata. Separate per-device permissions can allow bounded user/Devin message history and sending text to a previously discovered session. Sending is never implied by read permission and can be removed independently. The Connector does not return raw local session identifiers, full filesystem paths, other directories, agent thoughts, tool inputs or outputs, commands, local files, API credentials, or unknown ACP metadata. Tool approvals, file access, attachments, session creation, archive, termination, and arbitrary ACP actions are not supported by these grants.

Local-session responses remain only in the app's in-memory query cache and are removed during normal cache collection or when connections are wiped.

## Tailscale transport

Tailscale provides private network reachability between your iPhone and computer; DevinX still verifies and authorizes every request independently. Session traffic travels between those devices, not through a DevinX-operated relay. Use of Tailscale is governed by Tailscale's privacy policy and your account settings.

## Data sharing and sale

DevinX does not sell personal data and does not operate an intermediary server for normal app traffic. Data is shared only with services required for features you invoke: the Devin API, an explicitly paired computer, Tailscale for private-network transport, and, when configured, the scrubbed crash-reporting service.

## Contact

For support or privacy questions, open an issue at `https://github.com/fenner888/Devinx/issues`.
