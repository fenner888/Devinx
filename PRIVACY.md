# DevinX Privacy Policy

Effective: July 9, 2026

DevinX is an independent, unofficial client for the Devin API. It is not affiliated with, endorsed by, or a product of Cognition AI.

## Data processed

DevinX sends the credentials, prompts, attachments, and session actions you provide directly to the Devin API at `api.devin.ai` over encrypted HTTPS connections. Cognition's handling of that data is governed by its own terms and privacy policies.

DevinX stores the following on your device:

- Devin API credentials and organization identifiers in the operating system Keychain or secure credential store
- app preferences, selected repositories, and session display context in local app storage
- a read cache of session metadata for offline access

Disconnecting your account removes stored credentials and cached session data from the device.

## Analytics

DevinX does not currently enable a product analytics SDK. Session titles, prompts, messages, repository names, source code, and attachment contents are not sent to an analytics provider.

## Crash reports

Production builds may use Sentry for crash diagnostics. Before a report is sent, DevinX removes authorization headers, API-key-like strings, organization identifiers, URLs containing credentials, and session message content. Crash reporting is disabled when no Sentry DSN is configured.

## Local computer access

DevinX cannot access Devin Local or Cascade sessions, your computer's filesystem, local repositories, terminal history, or uncommitted changes. It accesses only cloud resources made available through the Devin API.

## Data sharing and sale

DevinX does not sell personal data. It does not operate an intermediary server for normal app traffic. Data is shared only with services required for features you invoke, principally the Devin API and, when configured, the scrubbed crash-reporting service.

## Contact

For support or privacy questions, open an issue at `https://github.com/fenner888/Devinx/issues`.
