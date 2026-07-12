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
2. the active ACP agent supplies the authoritative model selector from session `configOptions`.

Recent model IDs are optional hints. Empty historical model markers are ignored rather than making
workspace discovery unavailable; they never become selectable IDs. The live ACP catalog remains
authoritative for creation.

The Connector obtains ACP configuration from a bounded existing-session load and caches the
sanitized catalog for the Connector process lifetime. It does not create a probe session, send a
prompt, expose replayed content, or return raw ACP extensions. If live discovery is unavailable, the
Connector may return the bounded recent list as an explicitly non-authoritative fallback.

Returned model fields are limited to:

- model ID and agent-provided display name;
- optional bounded description;
- whether the model is the current agent recommendation;
- whether it was recently used;
- optional image-support capability;
- an optional allowlisted badge value supplied by trusted ACP metadata.

The phone still submits only an exact model ID returned by `session.create_options`. On creation the
Connector revalidates the selected ID against the new session's live `configOptions` before applying
it, so stale catalogs fail closed.

## Security and compatibility

- Protected requests remain signed, replay-protected, rate-limited, and Zod validated.
- No conversation text, raw session identifier, filesystem path, or arbitrary ACP `_meta` value is
  returned to the phone.
- Catalog and string sizes are bounded; duplicate IDs fail validation.
- Unknown metadata is ignored. Only explicit allowlisted scalar keys can influence presentation.
- No new dependency or hardcoded model catalog is introduced.
- This remains a coordinated pre-release Connector/mobile contract change. The updated Connector is
  not distributed ahead of the matching mobile build; public compatibility/version negotiation must
  be finalized before independent Connector updates are enabled.

## Validation

- ACP tests cover full ordered catalogs, descriptions, recommendation, metadata allowlisting,
  duplicate rejection, in-use-session fallback, and no session creation or prompting during
  discovery.
- Bridge tests cover recent/live merging, bounded responses, stale-model rejection, and metadata
  minimization.
- Mobile tests cover Recommended, Recent, All Models, search, deduplication, badges, dismissal,
  accessibility labels, model-family grouping, reasoning/speed selection, exact-ID resolution, and
  selected-model behavior.
- Physical QA confirms the list matches the installed Devin CLI and that a model absent from prior
  history can create and run a session over Tailscale.
