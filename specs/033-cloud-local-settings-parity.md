# 033 — Cloud, Web, and local settings parity

Status: July 13 authenticated re-audit and supported MCP-backed parity implementation complete;
physical TestFlight validation pending

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

A second authenticated review on July 13, 2026 found that the official Devin MCP now documents a
permissioned `list_integrations` tool plus repository-documentation tools. That supported surface
changes the earlier decision to keep all integration and Wiki discovery Web-only. DevinX may use the
documented Streamable HTTP MCP endpoint with the same Keychain-backed `cog_` credential, but it must
not infer unlisted write tools or reuse Web OAuth/browser state.

## Authentication boundary

DevinX Cloud authenticates with a service-user credential stored in the iOS Keychain. The service
user is its own principal and receives only its assigned RBAC permissions. `create_as_user_id`
changes session attribution when `ImpersonateOrgSessions` is granted; it does not turn the caller
into the human user. Personal Access Tokens would use the human principal, but remain closed beta.

Every unavailable permission must produce a feature-specific unavailable state. It must not reveal
whether an unauthorized resource exists, and write controls must not render as enabled merely
because a similarly named Web control exists.

## Parity matrix

| Web surface                                                             | Current DevinX                                                          | Decision                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal profile, language, notifications, git identity, PR defaults    | Theme is device-local; other controls absent                            | Web-owned. No documented standard organization endpoint for personal preferences. Browser, Slack, newsletter, and Web onboarding controls do not belong in the mobile client.                                                                                                                                                      |
| Personal integrations and Devin Desktop login                           | Computer pairing is separate and user controlled                        | Personal OAuth and Desktop login stay Web/Desktop-owned. Do not copy Web login state, OAuth grants, or integration cookies. Organization integration status may still be shown through the official Devin MCP.                                                                                                                     |
| Organization general and data-sharing policy                            | In-app privacy disclosure exists                                        | Web-owned until a documented organization-scoped API exists. DevinX's own collection and storage controls remain independent.                                                                                                                                                                                                      |
| Organization integrations and MCP servers                               | Native read-only Connections catalog through official Devin MCP         | Complete for the documented read surface. Installation, OAuth, custom MCP creation, secret headers, and configuration changes remain unavailable because no documented write tool exists. |
| Plans and invoices                                                      | Not exposed                                                             | Web-owned. The public API does not expose self-serve plan, invoice, daily/weekly quota, on-demand balance, or auto-reload management.                                                                                                                                                                                              |
| Usage & limits                                                          | Native organization consumption and permission-gated enterprise metrics | Keep. Explain that self-serve quota/balance values remain unavailable rather than linking an internal Web page.                                                                                                                                                                                                                    |
| Devin organization defaults, commands, deployment, PR, and bot settings | Session creation exposes documented per-session inputs                  | Keep organization mutation out of DevinX until documented management endpoints exist. Continue to expose documented per-session mode, platform, integer ACU, repository, playbook, knowledge, secret, structured-output, and tag inputs only. Do not render disabled copies of unsupported organization controls.                                            |
| Devin Review                                                            | Native trigger and latest-status lookup                                 | Keep. Organization auto-review, comment-posting, security-analysis, and spend-policy settings remain Web-owned without a documented API.                                                                                                                                                                                           |
| DeepWiki and Wiki                                                       | Native repository/index status plus documented MCP Wiki reads            | Browse repository documentation through official Devin MCP tools: `list_available_repos`, `read_wiki_structure`, `read_wiki_contents`, and `ask_question`. The API now documents beta repository indexing mutations, but DevinX intentionally keeps repository administration read-only in v1 because it is a costly organization mutation that needs its own authorization, progress, retry, and recovery design. |
| Legacy Schedules / Automations                                          | Native recurring and one-time schedule CRUD                             | Complete for documented mobile-safe inputs, including platform, agent, notification preference, playbook, and tags. Privileged impersonation, approval bypass, Slack-target, and target-Devin controls remain hidden until a separate authorization UX exists. Event-driven Web Automations remain a distinct Web product unless an API is published. |
| Devin Desktop account settings                                          | DevinX Connector manages its own devices and local sessions             | Web-owned. Anthropic retention consent, provider keys, shared conversations, and Windsurf usage must not be inferred or copied.                                                                                                                                                                                                    |
| Knowledge                                                               | Native note CRUD, enable state, folder tree/filter/selection, and pinned repository | Complete for the documented note/folder surface. Suggestions remain Web-owned because no public endpoint is documented. |
| Environment / snapshots                                                 | Not exposed                                                             | Defer mutation. Snapshot setup is a broad beta administrative surface with blueprint files and build actions; it needs its own least-privilege spec and physical recovery tests.                                                                                                                                                   |
| Playbooks                                                               | Native CRUD, validated macro editing, and bounded structured-output schema editor | Complete for the documented playbook surface. The editor rejects external `$ref` values and enforces the documented 64 KB schema ceiling. |
| Skills & Rules                                                          | Not exposed                                                             | Web/CLI-owned. The installed CLI exposes `rules`, `skills`, and `plugins`, but current ACP and the documented Devin MCP do not advertise a safe Skills & Rules management capability. Do not show a nonfunctional mobile entry.                                                                                                    |
| Secrets                                                                 | Native metadata list, write-only create, destructive delete             | Keep. Secret values never return from the API, enter logs, or persist outside the request lifecycle.                                                                                                                                                                                                                               |
| Repositories                                                            | Composer picker plus read-only Repositories & Wiki settings screen      | Complete for the documented read surface. Repository integration and indexing mutations remain gated. |
| Membership                                                              | Used only when documented attribution discovery is available            | Do not make DevinX an organization-admin console in v1. Member invitation/role changes are unrelated to mobile mission control and carry material account risk.                                                                                                                                                                    |
| Devin API / service users                                               | Current credential identity and fingerprint shown                       | Keep credential provisioning and rotation out of the app. Never generate, display, copy, or persist additional API keys.                                                                                                                                                                                                           |
| Analytics                                                               | Native organization metrics with permission fallback                    | Keep. Enterprise-only dimensions remain unavailable to organization-scoped credentials.                                                                                                                                                                                                                                            |

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

## Completed implementation evidence

1. The Streamable HTTP client uses the Keychain-backed provider, derives `X-Org-Id`, negotiates a
   bounded MCP session, validates JSON-RPC/tool payloads with Zod, and does not log or cache them.
2. Connections & MCP discovery is native and read-only through `list_integrations`; unsupported
   install/edit controls are absent.
3. Repository discovery remains explicitly `v3beta1`, with bounded cursor pagination, identity
   deduplication, Zod parsing, and fail-closed partial-result behavior.
4. Repositories & Wiki uses documented MCP structure/content/question tools without exposing
   generation or indexing mutations.
5. Knowledge folders, filtering, selection, enable state, and pinned repositories are implemented.
6. Playbook macro and bounded self-contained structured-output schema editing are implemented.
7. Schedule create/update supports documented recurring/one-time inputs and platform selection;
   privilege-bearing controls remain an intentional boundary.
8. Cloud-resource, authorization, missing-permission, and response-body non-disclosure tests are
   release gates before TestFlight.

## Non-goals

- No private Web settings requests, browser-cookie reuse, or WebView embedding.
- No plan purchase, invoice, billing, API-key, member-role, integration-OAuth, MCP installation, or
  personal-profile management.
- No local rules/skills/plugins management through shell execution.
- No repository indexing or Wiki generation/regeneration mutation in this phase. This is an
  intentional v1 boundary, not a claim that the beta API lacks those routes.
- No official Code Scan creation until Cognition publishes a supported user-principal route.

## Sources

- <https://docs.devin.ai/api-reference/authentication>
- <https://docs.devin.ai/api-reference/v3/overview>
- <https://docs.devin.ai/api-reference/v3/notes/organizations-knowledge-folders>
- <https://docs.devin.ai/api-reference/v3/playbooks/post-organizations-playbooks>
- <https://docs.devin.ai/api-reference/v3/repositories/list-organizations-indexed-repositories>
- <https://docs.devin.ai/api-reference/v3/schedules/post-organizations-schedules>
- <https://docs.devin.ai/work-with-devin/devin-mcp>
