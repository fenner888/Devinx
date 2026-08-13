# 026 — Live local model catalog parity

Status: implemented and automated-test validated in iOS Build 29; exact selected-model physical verification remains

## Product contract

The Computer composer must present the complete model catalog offered by the paired Devin CLI, not
only models found in prior local sessions. DevinX preserves the agent-provided model order, display
name, description, default selection, and supported presentation metadata. Models observed in the
reviewed local session store remain useful only for a bounded `Recent` section.

The picker follows the current Devin interaction pattern:

- the agent-selected default is shown first as `Recommended`;
- recently used models are shown next, without duplicates;
- the complete live catalog is shown under `All Models` and is searchable;
- selection uses a simple checkmark and compact rows rather than nested cards;
- trusted `New` or promotion badges render only when Devin supplies an explicit supported metadata
  value. DevinX never guesses or hardcodes time-sensitive promotions.
- each model row reflects Devin's current catalog pricing metadata: exact `Free` models are labeled
  `Free`, while paid or variable-cost models receive a compact relative-cost indicator. This data
  refreshes with the catalog and is never inferred from a model name or maintained as a static list.

When ACP exposes several exact IDs for one model family, DevinX may present those IDs as two
controls: model family and reasoning/speed variant. Presentation grouping is derived only from the
agent-provided display names using a bounded, tested suffix grammar (`None`, `Low`, `Medium`,
`High`, `XHigh`, `Max`, `Minimal`, `Thinking`, `Fast`, `Lightning`, and `1M`). Unknown names remain
standalone families and therefore cannot be misrouted. Every visible variant retains its exact ACP
ID; DevinX never synthesizes an ID or submits a family label to the Connector.

Cloud and Computer remain separate contracts. The public Cloud API currently exposes Devin mode,
not arbitrary model IDs, so the Cloud composer must not claim model selection parity that the API
cannot enforce.

## Connector contract

`session.create_options` combines two local sources:

1. the reviewed session store supplies opaque workspace handles and ordered recent model IDs;
2. the installed Devin CLI supplies the authoritative account-scoped catalog through
   `devin models list --format json`.

Recent model IDs are optional hints. Empty historical model markers are ignored rather than making
workspace discovery unavailable; they never become selectable IDs. The live CLI catalog remains
authoritative for creation.

The Connector obtains the complete catalog from the installed Devin CLI's bounded,
machine-readable `models list` command and caches the sanitized result for the Connector process
lifetime. The CLI output is account scoped and therefore reflects only models available to the
signed-in Devin user. The Connector keeps the prior bounded existing-session ACP discovery as a
compatibility fallback for older CLI releases that do not expose the command.

The phone may explicitly request a refresh through the authenticated `session.create_options`
request body with `{ "refresh": true }`. A refresh bypasses the process cache, reruns the
machine-readable catalog command, and replaces the cache only after a valid live catalog is
available. It does not create a probe session, send a prompt, expose replayed content, or return raw
CLI or ACP extensions.

The Home and Local-session model pickers refresh automatically when opened and also expose a
44-point accessible refresh control. While refresh is in progress the previous validated catalog
stays usable. If refresh fails, DevinX keeps that catalog visible and shows a recoverable error; it
does not relabel recent history as a successful live refresh. For ordinary non-refresh loading, if
live discovery is unavailable, the Connector may still return the bounded recent list as an
explicitly non-authoritative fallback.

Returned model fields are limited to:

- model ID and agent-provided display name;
- optional bounded description;
- whether the model is the current agent recommendation;
- whether it was recently used;
- optional image-support capability;
- an optional allowlisted badge value supplied by trusted ACP metadata.
- optional bounded cost summary and normalized cost tier supplied by the installed Devin CLI.

The phone still submits only an exact model ID returned by `session.create_options`. On creation the
Connector revalidates the selected ID against the new session's live `configOptions` before applying
it, so stale catalogs fail closed.

## Security and compatibility

- Protected requests remain signed, replay-protected, rate-limited, and Zod validated.
- The optional refresh flag is the only accepted `session.create_options` input and is authorized
  by the existing `session:metadata:read` grant.
- No conversation text, raw session identifier, filesystem path, or arbitrary ACP `_meta` value is
  returned to the phone.
- Catalog and string sizes are bounded; duplicate IDs fail validation.
- Unknown metadata is ignored. Only explicit allowlisted scalar keys can influence presentation.
- No new dependency or hardcoded model catalog is introduced. The only default-selection fallback
  is the CLI's stable `adaptive` model when it is present; otherwise the first validated
  account-scoped model is used only to satisfy the existing ACP recommendation contract.
- This remains a coordinated pre-release Connector/mobile contract change. The updated Connector is
  not distributed ahead of the matching mobile build; public compatibility/version negotiation must
  be finalized before independent Connector updates are enabled.

## Validation

- CLI and ACP tests cover full ordered catalogs, descriptions, recommendation, metadata
  allowlisting, duplicate rejection, bounded output, in-use-session fallback, and no session
  creation or prompting during discovery.
- Bridge tests cover recent/live merging, bounded responses, stale-model rejection, and metadata
  minimization, including forced-refresh propagation and failure preservation.
- Mobile tests cover Recommended, Recent, All Models, search, deduplication, badges, dismissal,
  accessibility labels, model-family grouping, reasoning/speed selection, exact-ID resolution,
  selected-model behavior, and refresh success/failure states.
- Physical QA confirms the list matches the installed Devin CLI and that a model absent from prior
  history can create and run a session over Tailscale. It also confirms that opening either Local
  picker discovers a newly available ACP model without restarting DevinX Connector.
