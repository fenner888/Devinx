# DevinX Privacy Policy

Effective: July 9, 2026

DevinX is an independent, unofficial client for the Devin API. It is not affiliated with, endorsed by, or a product of Cognition AI.

## Data processed

DevinX sends the credentials, prompts, attachments, and session actions you provide directly to the Devin API at `api.devin.ai` over encrypted HTTPS connections. Cognition's handling of that data is governed by its own terms and privacy policies.

DevinX stores the following on your device:

- Devin API credentials and organization identifiers in the operating system Keychain or secure credential store
- app preferences, selected repositories, and session display context in local app storage
- a read cache of session metadata for offline access
- per-device Desktop Bridge credentials in the operating system Keychain when you pair a Mac

Disconnecting your account removes stored credentials and cached session data from the device.

## Analytics

DevinX does not currently enable a product analytics SDK. Session titles, prompts, messages, repository names, source code, and attachment contents are not sent to an analytics provider.

## Crash reports

Production builds may use Sentry for crash diagnostics. Before a report is sent, DevinX removes authorization headers, API-key-like strings, organization identifiers, URLs containing credentials, and session message content. Crash reporting is disabled when no Sentry DSN is configured.

## Local computer access

When you explicitly enable Computer Connection, DevinX can connect directly to a Desktop Bridge running on a Mac you control. Pairing requires a short-lived QR code, explicit approval on the Mac, a unique iPhone signing key, and a pinned TLS certificate.

The default grant exposes minimized session metadata. A separate Mac-side approval can allow read-only Devin CLI session titles and user/Devin message text. The bridge does not return raw local session identifiers, full filesystem paths, additional directories, agent thoughts, tool inputs or outputs, commands, local files, API credentials, or unknown ACP metadata. Message steering and other mutation permissions remain separate and are not implied by read access.

Local-session responses may remain briefly in the app's in-memory query cache. Disconnecting and wiping connections removes the paired credentials and application query cache.

## Tailscale and private-network transport

You may connect the Desktop Bridge over the same private Wi-Fi network or through a Tailscale network you manage. Tailscale provides network reachability; DevinX continues to authenticate and authorize every bridge request independently. Session traffic travels between your iPhone and your Mac, not through a DevinX-operated relay. Use of Tailscale is governed by Tailscale's own privacy policy and account settings.

## Data sharing and sale

DevinX does not sell personal data. It does not operate an intermediary server for normal app traffic. Data is shared only with services required for features you invoke: principally the Devin API, your explicitly paired Desktop Bridge, an optional user-managed private-network provider such as Tailscale, and, when configured, the scrubbed crash-reporting service.

## Contact

For support or privacy questions, open an issue at `https://github.com/fenner888/Devinx/issues`.
