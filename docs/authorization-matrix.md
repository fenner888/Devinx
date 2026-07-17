# Authorization matrix

Reviewed against the active Phase 4A implementation on July 13, 2026. This matrix covers the user-controlled Connector HTTP boundary, genuine Code Scan session discovery, and documented organization resources. Devin Cloud authorization remains enforced server-side by the Devin API and the user's credential scopes.

| Method                   | Required device grant   | Input validation                                                       | Resource binding                                                                                                                                       | Unauthorized result     | Rate limit class     |
| ------------------------ | ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------- |
| `bridge.health`          | `bridge:health`         | strict empty Zod object                                                | paired device from signed envelope                                                                                                                     | indistinguishable `404` | health               |
| `bridge.features`        | `bridge:health`         | strict empty Zod object                                                | paired device from signed envelope; returns only bounded capability booleans                                                                           | indistinguishable `404` | mutation             |
| `bridge.version`         | `bridge:health`         | strict empty Zod object                                                | paired device from signed envelope; returns only the packaged semantic version                                                                          | indistinguishable `404` | health               |
| `device.revoke`          | `bridge:health`         | strict empty Zod object                                                | requesting device revokes itself                                                                                                                       | indistinguishable `404` | mutation             |
| `session.list`           | `session:metadata:read` | strict optional bounded cursor                                         | opaque handles minted for this bridge                                                                                                                  | indistinguishable `404` | session list         |
| `session.load`           | `session:content:read`  | strict local-handle schema                                             | handle must have been listed for this device/session scope                                                                                             | indistinguishable `404` | session history read |
| `session.prompt`         | `session:prompt:send`   | strict handle, bounded non-empty text, and optional bounded model ID   | handle must have been listed for this device/session scope; model is revalidated against the loaded session's live ACP selector before prompt dispatch | indistinguishable `404` | mutation             |
| `session.create_options` | `session:metadata:read` | strict empty Zod object                                                | only visible reviewed workspaces become opaque handles                                                                                                 | indistinguishable `404` | mutation             |
| `session.create`         | `session:create`        | strict workspace handle, optional model ID, and bounded non-empty text | workspace handle must be issued by this bridge; workspace and model are revalidated immediately before ACP dispatch                                    | indistinguishable `404` | mutation             |

## Public Security Work boundary

| Method                                    | Required Devin permission | Input validation                                                            | Resource binding                                             | Unauthorized presentation                                                 | Retry policy                                       |
| ----------------------------------------- | ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /v3/organizations/{org_id}/sessions` | `ViewOrgSessions`         | bounded cursor pagination; every item parses through the session Zod schema | organization is derived only from the authenticated provider | normal generic session error; no cached or cross-org metadata is invented | deterministic auth/permission failures never retry |

Only top-level sessions whose canonical origin is exactly `code_scan` become Security Work roots. Titles, prompts, categories, and tags do not qualify an ordinary session. Parent-child grouping controls presentation only. Opening a coordinator or worker still calls the normal authorized Session Detail APIs. The supported Sessions API cannot create a `code_scan`, so this screen exposes no scan-creation mutation.

## Documented organization-resource boundary

| Resource operations                          | Required Devin permission                       | Input/response validation                                                                                                                   | Resource binding                                                                                 | Unauthorized presentation                                                   |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Repositories and index status: read only     | `Read` at organization level                    | bounded 100-item pages, repeated/missing cursor rejection, 1,000-item limit, identity deduplication, nested indexing Zod schema             | organization comes only from `AuthProvider.orgPath()`; no index mutation exists in the screen    | generic unavailable state; no repository metadata rendered                  |
| Session output attachments: read only        | `ViewOrgSessions`                               | session ID normalization plus strict attachment-list Zod schema; URLs must be valid                                                        | organization comes only from `AuthProvider.orgPath()` and session ID comes from the authorized session response | generic unavailable state; no raw remote error or attachment metadata rendered |
| Organization analytics: read only            | organization metrics permission                 | required integer time bounds plus Zod schemas for session, PR, search, unique-active-user, DAU, WAU, and MAU responses                      | organization comes only from `AuthProvider.orgPath()`; no enterprise metrics route or cross-org selector is accepted | granular optional series degrade to unavailable; no remote response body rendered |
| Knowledge: list/folders/create/update/delete | Knowledge management grant for the organization | bounded 100-item pages, repeated/missing cursor rejection, 1,000-item limit, note/folder Zod schemas, nullable enable state, and optional pinned-repository validation | organization comes only from the provider; note and folder IDs come only from parsed responses   | generic unavailable/save failure; server response bodies are never rendered |
| Playbooks: list/create/update/delete         | `ManageOrgPlaybooks` or inherited equivalent    | bounded 100-item pages, repeated/missing cursor rejection, 1,000-item limit, non-empty title/body, macro validation, and self-contained Draft 7 JSON Schema capped at 64 KB | organization comes only from the provider; playbook IDs come only from parsed responses          | generic unavailable/save failure; no resource-existence detail              |
| Schedules: list/create/update/delete         | `ManageOrgSchedules`                            | bounded pagination, repeated/missing cursor rejection, response Zod schema, recurring cron or future ISO timestamp, bounded names/prompts, documented platform/notification/agent enums | organization comes only from the provider; schedule/playbook IDs come only from parsed responses | generic unavailable/action failure; no raw API detail                       |
| Secrets: list/create/delete                  | `ManageOrgSecrets`                              | bounded pagination; strict metadata-only response Zod schema; write-only create payload; unexpected response keys are stripped              | organization comes only from the provider; secret values never return or enter client cache      | generic unavailable/action failure; no secret value or server body          |

## Official Devin MCP boundary

| Tool operations                                                | Required Devin permission                                         | Input/response validation                                                                                                                                                        | Resource binding                                                                                                                                  | Unauthorized presentation                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Integrations and MCP servers: read-only catalog                | permission to use the official Devin MCP `list_integrations` tool | JSON-RPC envelopes, MCP initialization, tool content, and normalized catalog items parse through Zod; responses are capped at 4 MB                                               | bearer authorization and organization ID come only from `AuthProvider`; no install, OAuth, custom-server, or secret-configuration mutation exists | generic unavailable state; response bodies and tool errors are never rendered                |
| Repository Wiki: structure/content read and question answering | permission to use the official Devin MCP Wiki tools               | repository names are trimmed, non-empty, and capped at 512 characters; questions are non-empty and capped at 4,000 characters; every MCP envelope/tool result parses through Zod | repository names come from the separately authorized, parsed repository list; organization and authorization come only from `AuthProvider`        | generic unavailable/answer failure; no repository-generation or indexing mutation is exposed |

The MCP transport negotiates protocol version `2025-06-18`, binds subsequent calls to the returned
session ID, includes the organization header derived from the provider path, and never places the
credential in a JSON body, log, diagnostic, query cache key, or component state. Selecting
Computer-only mode disables these Cloud requests and removes the Settings entry; direct navigation
fails closed with an unavailable state.

The current Devin documentation uses inconsistent names for the organization Knowledge and Playbook grants on individual pages versus the RBAC overview. DevinX does not infer a broader role from those labels: the authenticated Devin API remains authoritative and the UI fails closed on permission denial. Schedule writes and reads accept only the two agents in the current OpenAPI enum: `devin` and `data_analyst`.

All Cloud errors are converted through `userFacingError` before display. The API client discards
non-success response bodies rather than retaining them in an `Error`; raw response bodies, schema
paths, repository identifiers, prompts, session content, and secret metadata are never rendered as
error copy or sent to diagnostics.

## Excluded Devin Code Scan enterprise boundary

The documented enterprise findings, metrics, and remediation endpoints are not implemented or
compiled into the v1 client. There is no documented create-scan method. DevinX does not probe or
guess any of those routes and does not use an external web handoff, private endpoint, browser
cookie, service-account impersonation, or Connector scrape. The public route displays only genuine
`code_scan` sessions but never labels their normal session logs as structured scan findings. A
future enterprise integration requires a separate specification and authorization-matrix review.

## Request gates

Every method passes the same server-side sequence before its handler runs:

1. Parse the complete request envelope and method-specific body with Zod.
2. Find the paired device without exposing whether an unknown device exists.
3. Verify timestamp freshness, nonce uniqueness, request signature, and method permission.
4. Bind local-session actions to an opaque session or workspace handle previously issued by this bridge.
5. Apply peer and per-device/method rate limits.
6. Return only schema-minimized output.

Client-side permission checks only control presentation. The Connector remains authoritative and re-evaluates the current device record on every request. Removing `session:prompt:send` or `session:create` therefore blocks the corresponding mutation even if the phone retained an older pairing receipt.

## Cross-device and IDOR cases

- A signature from device A cannot authenticate as device B.
- A handle invented by, listed to, or copied from another device is rejected.
- A revoked device cannot call health, list, load, prompt, create, or revoke again as an authenticated device.
- Read permission does not imply send permission.
- Prompt permission does not imply session-create permission.
- The phone never receives a workspace path and cannot submit an arbitrary path, CLI argument, MCP server, or raw session ID.
- Message sending cannot invoke tool approval, filesystem, command, attachment, archive, or termination actions.

Automated evidence lives in `tests/bridge/security-core.test.ts`, `tests/bridge/bridge-service.test.ts`, `tests/auth/computer-bridge.test.ts`, and the pairing/device-management suites.
