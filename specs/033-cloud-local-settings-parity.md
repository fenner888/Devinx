# 033 — Cloud, Web, and local settings parity

Status: authenticated inventory, supported parity implementation, and release matrix complete;
physical TestFlight validation remains pending

## Objective

Expose every useful Devin Cloud or local-computer control that DevinX can support through a
documented, permissioned interface. A visible Web setting is not, by itself, an API contract.
DevinX must not consume browser cookies, call private Web endpoints, infer undocumented request
schemas, or make a service user impersonate the signed-in human account.

The authenticated inventory was performed on July 12, 2026 against a Pro organization. It covered
Personal Preferences and Connections; organization General, Connections, Plans, Invoices, and
Usage; product settings for Devin, Review, DeepWiki, Schedules, and Devin Desktop; resources for
Knowledge, Environment, Playbooks, Skills & Rules, and Secrets; and administration for
Repositories, Membership, Devin API, and Analytics. No setting was changed during the inventory.

## Authentication boundary

DevinX Cloud authenticates with a service-user credential stored in the iOS Keychain. The service
user is its own principal and receives only its assigned RBAC permissions. `create_as_user_id`
changes session attribution when `ImpersonateOrgSessions` is granted; it does not turn the caller
into the human user. Personal Access Tokens would use the human principal, but remain closed beta.

Every unavailable permission must produce a feature-specific unavailable state. It must not reveal
whether an unauthorized resource exists, and write controls must not render as enabled merely
because a similarly named Web control exists.

## Parity matrix

| Web surface | Current DevinX | Decision |
|---|---|---|
| Personal profile, language, notifications, git identity, PR defaults | Theme is device-local; other controls absent | Web-owned. No documented standard organization endpoint for personal preferences. Browser, Slack, newsletter, and Web onboarding controls do not belong in the mobile client. |
| Personal integrations and Devin Desktop login | Computer pairing is separate and user controlled | Web-owned. Do not copy Web login state, OAuth grants, or integration cookies. |
| Organization general and data-sharing policy | In-app privacy disclosure exists | Web-owned until a documented organization-scoped API exists. DevinX's own collection and storage controls remain independent. |
| Organization integrations | Repository picker uses documented repository data | Keep integration configuration Web-owned. Expose only documented repository availability/index status. |
| Plans and invoices | Not exposed | Web-owned. The public API does not expose self-serve plan, invoice, daily/weekly quota, on-demand balance, or auto-reload management. |
| Usage & limits | Native organization consumption and permission-gated enterprise metrics | Keep. Explain that self-serve quota/balance values remain unavailable rather than linking an internal Web page. |
| Devin organization defaults, commands, deployment, PR, and bot settings | Session creation exposes documented per-session inputs | Web-owned. Do not duplicate private settings calls. Continue to expose documented session parameters only. |
| Devin Review | Native trigger and latest-status lookup | Keep. Organization auto-review, comment-posting, security-analysis, and spend-policy settings remain Web-owned without a documented API. |
| DeepWiki | Repositories can be selected for sessions; no index-status screen | Add a native read-only Repositories & Wiki screen using documented repository availability and indexing endpoints. Index mutations require a separate explicit permissioned spec and confirmation. |
| Legacy Schedules / Automations | Native recurring schedule CRUD | Complete documented parity for recurring and one-time schedules, agent selection, notification preference, playbook, and tags. Event-driven Web Automations remain a distinct Web product unless an API is published. |
| Devin Desktop account settings | DevinX Connector manages its own devices and local sessions | Web-owned. Anthropic retention consent, provider keys, shared conversations, and Windsurf usage must not be inferred or copied. |
| Knowledge | Native note CRUD and enable toggle | Add documented folder-tree loading, folder filtering, and folder selection when editing or creating a note. Suggestions remain Web-owned because no public endpoint is documented. |
| Environment / snapshots | Not exposed | Defer mutation. Snapshot setup is a broad beta administrative surface with blueprint files and build actions; it needs its own least-privilege spec and physical recovery tests. |
| Playbooks | Native CRUD; macro displayed but not editable | Add validated macro editing. Structured-output schemas require a separate schema-editor design and size/complexity safeguards before exposure. |
| Skills & Rules | Not exposed | Web/CLI-owned. The installed CLI exposes `rules`, `skills`, and `plugins`, but current ACP does not advertise a safe management capability and the public REST index has no Skills & Rules endpoint. |
| Secrets | Native metadata list, write-only create, destructive delete | Keep. Secret values never return from the API, enter logs, or persist outside the request lifecycle. |
| Repositories | Composer picker only | Add the read-only Repositories & Wiki settings screen. Repository integration and indexing mutations remain gated. |
| Membership | Used only when documented attribution discovery is available | Do not make DevinX an organization-admin console in v1. Member invitation/role changes are unrelated to mobile mission control and carry material account risk. |
| Devin API / service users | Current credential identity and fingerprint shown | Keep credential provisioning and rotation out of the app. Never generate, display, copy, or persist additional API keys. |
| Analytics | Native organization metrics with permission fallback | Keep. Enterprise-only dimensions remain unavailable to organization-scoped credentials. |

## Local computer inventory

The installed Devin CLI reports version `3000.1.27 (0d4bf12e)`. A value-free ACP negotiation on
July 12, 2026 advertised:

- `sessionCapabilities.list`;
- `loadSession`;
- `sessionCapabilities.additionalDirectories`;
- `promptCapabilities.image`; and
- `promptCapabilities.embeddedContext`.

It did not advertise session resume, close, delete, or fork, nor audio or HTTP/SSE MCP transport.
DevinX therefore keeps its existing capability-gated list/load/create/steer/model workflow. Local
image transfer and additional directories remain deferred until protocol size, file access,
content-type, path, lifecycle, and permission rules are specified and tested. CLI `rules`, `skills`,
`plugins`, `mcp`, `cloud`, update, setup, and uninstall commands are not ACP capabilities and must not
be invoked indirectly from the phone.

## Implementation sequence

1. Keep repository discovery and indexing reads on the documented `v3beta1` organization paths,
   with bounded cursor pagination, identity deduplication, Zod parsing, and explicit partial-result
   failure. Do not relabel the beta contract as stable v3.
2. Add Repositories & Wiki as a permission-gated, read-only native settings screen using the
   indexing status already returned by the documented repository list.
3. Add Knowledge folder schemas, endpoint, query, grouping, filter, and editor selection.
4. Add validated Playbook macro editing without changing structured-output schemas.
5. Complete the documented Schedule editor options and retain explicit destructive confirmation.
   The current documentation mentions an `advanced` agent in prose but omits it from the request
   enum table. DevinX displays unknown read values but offers only the unambiguous documented write
   values (`devin` and `data_analyst`) until Cognition resolves that contract discrepancy.
6. Run the full Cloud-resource and authorization matrix with missing-permission fixtures before any
   TestFlight build.

## Non-goals

- No private Web settings requests, browser-cookie reuse, or WebView embedding.
- No plan purchase, invoice, billing, API-key, member-role, integration-OAuth, or personal-profile
  management.
- No local rules/skills/plugins management through shell execution.
- No repository indexing or snapshot mutation in this phase.
- No official Code Scan creation until Cognition publishes a supported user-principal route.

## Sources

- <https://docs.devin.ai/api-reference/authentication>
- <https://docs.devin.ai/api-reference/v3/overview>
- <https://docs.devin.ai/api-reference/v3/notes/organizations-knowledge-folders>
- <https://docs.devin.ai/api-reference/v3/playbooks/post-organizations-playbooks>
- <https://docs.devin.ai/api-reference/v3/repositories/list-organizations-indexed-repositories>
- <https://docs.devin.ai/api-reference/v3/schedules/post-organizations-schedules>
