# DevinX documentation parity audit — July 17, 2026

## Scope and method

This audit compares the public DevinX mobile and Connector implementation with the current
official Devin Cloud API, Devin MCP, Devin CLI/ACP, and Devin Desktop documentation. It is a
contract audit, not a comparison with private Web requests, browser cookies, undocumented
Desktop state, or controls merely visible in Cognition's first-party UI.

Sources reviewed:

- the published v3 OpenAPI document and API release notes;
- authentication, sessions, attachments, repositories, consumption, resources, schedules,
  PR Review, metrics, and enterprise endpoint reference pages;
- the official Devin MCP tool catalog;
- CLI commands, models, Adaptive, handoff, and ACP documentation;
- Devin Desktop local-session and Agent Command Center documentation;
- a value-free live ACP capability probe against the installed Devin CLI.

Result labels:

- **Supported** — implemented through a documented interface and validated at the boundary.
- **Corrected** — drift found by this audit and corrected before the next build.
- **Intentional boundary** — documented, but excluded from v1 for authorization, product, or
  platform reasons recorded below.
- **Unavailable** — no public callable contract supports a truthful mobile implementation.

## End-to-end parity matrix

| Surface | Official documented contract | DevinX result | Audit conclusion |
| --- | --- | --- | --- |
| Cloud authentication | `cog_` service-user bearer credentials; org-scoped routes; human attribution requires `ImpersonateOrgSessions`; PATs are closed beta | Service-user key, exact server-issued `org-` or `org_` ID, optional attribution, Keychain storage, live validation, full disconnect wipe | **Supported.** PAT onboarding now requires the exact release opt-in `EXPO_PUBLIC_ENABLE_PAT=true`; it is hidden by default. |
| Session creation | Current v3 fields include attachments, approval/playbook controls, attribution, five modes, knowledge, integer ACU limit, platform, playbook, repos, resumability, secrets, links, structured-output controls, tags, and title | Mobile exposes the safe documented core plus platform, resumability, links, transient session secrets, and bounded structured-output controls; server controls eligibility | **Corrected.** Removed stale `snapshot_id` and `unlisted`; ACU limit is integer; modes are `normal`, `fast`, `lite`, `ultra`, and `fusion`. Privilege-bearing approval/impersonation controls remain intentionally hidden. |
| Create retry safety | No current `idempotent` create parameter; no list `search` filter | Ambiguous create failures reconcile through a bounded authorized recent-session read and local comparison | **Corrected.** Undocumented `search` is no longer sent. |
| Session list | Cursor pagination with documented time, archive, origin, repo, schedule, service-user, session, tag, and user filters | Cursor list, local UI search/status derivation, caching, permission-aware origin grouping | **Corrected.** Stale `search`, `status`, and `pr_states` query fields removed from the typed boundary. |
| Session detail/lifecycle | Get, archive/unarchive, terminate, message send/auto-resume, tags, messages, insights | Timeline, steering, archive/terminate, tags, polling, insights, state derivation | **Supported.** Header and UI labels remain derived presentation, not invented API enum values. |
| Structured output | `structured_output` may be returned on the session; create accepts required/schema controls | Parsed and rendered as selectable formatted JSON | **Corrected.** Previously omitted from the response schema/UI. |
| Attachments | Upload/download endpoints, message/create attachment URLs, and documented session-output attachment list | Upload/send paths already present; session-output attachments now queried and shown in Worklog | **Corrected.** The dedicated session attachment endpoint was missing. |
| Repositories | Repository list/index status remains v3beta1; indexing mutation endpoints are documented beta routes | Complete bounded read pagination, dedupe, index status, repository picker/search | **Supported read-only.** Indexing writes remain an **intentional boundary** until a separate costly-mutation authorization/recovery spec exists. |
| Wiki / DeepWiki | Official MCP tools provide repository list, Wiki structure/content, and question answering | Native read/question experience through validated MCP calls | **Supported.** Generate/regenerate remains an intentional write boundary. |
| MCP integrations | Official MCP exposes a read-only integration catalog plus session, resource, schedule, and Wiki tools | Integration catalog and Wiki tools only | **Intentional boundary.** Existing REST session/resource/schedule implementations are used where exact public schemas are known; no MCP input schema is guessed. OAuth/install/custom-server mutation is unavailable. |
| Knowledge | Org knowledge notes and folders have documented CRUD/list contracts, including nullable enable state and pinned repository | Native list, folders, create, update, delete, selectors, enable state, and pinned-repository editing | **Corrected and supported**, permission-gated by Devin. |
| Playbooks | Org playbook list/CRUD, macros, and optional Draft 7 structured-output schema are documented | Native CRUD/selector with macro validation and a self-contained JSON Schema editor capped at 64 KB | **Corrected and supported**, permission-gated by Devin. External `$ref` values are rejected. |
| Schedules / automations | Documented schedule list/CRUD with bounded request enums and privilege-bearing optional fields | Native recurring/one-time management with platform, agent, notification, playbook, and tag inputs | **Corrected and supported.** Impersonation, approval bypass, Slack-target, and target-Devin controls are intentionally omitted pending a separate authorization UX. |
| Secrets | Metadata list, write-only create, delete; values never return | Native metadata/create/delete; complete bounded pagination; strict metadata parser strips unexpected keys | **Corrected and supported.** A server-returned value cannot enter cache or logs; no value-read control exists. |
| Usage and limits | Org daily consumption; enterprise billing cycles and scoped Devin ACU limits require `ManageBilling` | Daily usage for authorized orgs; enterprise read data only when credential permits | **Corrected and supported with tier boundary.** ACU limit scope (`enterprise`, `org`, or `user`) is now mandatory at the parser boundary. Purchase, invoices, credits, and billing mutations remain Web-only/unavailable. |
| Analytics | Org session, PR, search, active-user, DAU, WAU, and MAU metrics are documented | Native range analytics with granular session/PR/search metrics and graceful active-user series fallback | **Corrected.** Active-user, DAU, and MAU reads were added; enterprise-only fleet analytics remain an intentional admin boundary. |
| PR Review | Documented PR Review resources and operations | Native review list/detail/actions already bounded to public routes | **Supported where credential permits.** No browser-cookie reuse. |
| Security Work | Public Sessions API can read genuine sessions with exact origin `code_scan`; enterprise findings/metrics/remediation APIs require enterprise authorization; no documented public create-scan request | Session-based Code Scan roots and child work inspection; no fake scan creation or findings dashboard | **Supported session view.** Enterprise dashboard and create-scan controls are intentionally absent. |
| Organization/admin settings | Enterprise/org membership, audit logs, git permissions, API administration, billing and other admin endpoints are role/tier sensitive | Mobile exposes only useful public, permissioned product surfaces | **Intentional boundary.** No role management, API-key administration, integration OAuth, invoices, audit-log administration, or service-account impersonation. |
| CLI session discovery | `devin acp` negotiates ACP over stdio; live capability response is authoritative | Connector launches ACP, negotiates, validates, and exposes opaque device-scoped handles | **Supported.** No private CLI database or Desktop IPC scraping. |
| Local history and steering | Current live ACP advertises session list and `loadSession`; prompt steering is adapted through reviewed ACP behavior | List/load/steer with per-device grants, signatures, replay protection, rate limits, and 404 non-disclosure | **Supported against negotiated capabilities.** |
| Local creation/models | Models and Adaptive vary by account/runtime; live catalog is authoritative | Connector returns live reviewed workspaces and model choices and revalidates them immediately before create/send | **Corrected and supported.** Cloud modes and local models remain separate pickers; all five Cloud modes now persist correctly instead of silently dropping `lite`, `ultra`, or `fusion`. |
| Local unsupported capabilities | Current probe does not advertise resume, close, delete, fork, audio, or MCP HTTP/SSE | Controls are omitted/gated | **Correct.** None is emulated through shell commands or private state. |
| CLI commands / handoff | CLI documents slash commands and `/handoff`, but that does not make every command an ACP capability | No generic remote command runner or fabricated handoff button | **Intentional boundary.** A documented CLI feature is not assumed callable from ACP. |
| Devin Desktop | First-party Desktop supports local sessions and Agent Command Center | DevinX connects to supported CLI/ACP through the signed Connector, not private Desktop storage | **Correct architecture boundary.** |

## Complete public-contract coverage accounting

The downloaded official OpenAPI document contains **128 paths and 203 HTTP operations**. DevinX
does not equate that count with a requirement to become an enterprise administration client. The
operations were accounted for as follows:

- **Implemented organization product routes:** sessions and lifecycle, messages, tags,
  attachments, insights, consumption, metrics, Knowledge, Playbooks, Schedules, Secrets, and PR
  Review.
- **Implemented beta reads:** repository catalog and index status. Repository indexing writes are
  deliberately excluded.
- **Implemented selected enterprise reads:** consumption cycles and scoped Devin ACU limits, only
  when the credential has the documented billing permission.
- **Identity-only support routes:** `/v3/self` and documented organization/enterprise member reads
  used solely for attribution discovery; DevinX does not expose member administration.
- **Deliberately excluded enterprise/admin families:** audit logs, Code Scan findings/metrics and
  remediation, git-provider administration, hypervisors, IDP/group/member administration,
  organization administration, roles, queue, API-key administration, guardrails, IP access lists,
  global fleet resources, and organization-wide default/tag administration.
- **Deliberately excluded beta mutation families:** snapshot blueprints/builds and repository
  indexing. These are costly organization mutations that need their own recovery and
  authorization design.
- **Redundant documented aggregate:** organization `/metrics/usage` is not given a separate screen;
  DevinX already presents the richer documented session, PR, search, active-user, and consumption
  data. This is an intentional presentation choice, not a fabricated capability.

Every callable Cloud route in the app is present in the official OpenAPI or the separately
documented Devin MCP contract. No private Web route, browser cookie, or guessed MCP input schema was
found in the shipping source.

## Findings corrected in this audit

1. Expanded the Cloud mode contract and picker from two modes to all five documented values.
2. Removed obsolete create-session fields and made outbound create/secret schemas strict.
3. Enforced integer `max_acu_limit` values in validation and the composer.
4. Added current create-session fields to the typed/Zod contract without inventing UI claims.
5. Removed stale session-list filters and replaced undocumented server search during ambiguous
   create reconciliation with an authorized bounded read plus local matching.
6. Added `structured_output` response parsing and display.
7. Added the documented session-output attachments endpoint, query, validation, and Worklog UI.
8. Changed PAT availability from a permissive default to an exact release opt-in.
9. Completed the native Analytics read surface with documented active-user, DAU, and MAU metrics.
10. Updated the build spec, API delta record, settings parity record, ACP compatibility baseline,
   tests, and authorization matrix so the source of truth matches the implementation.
11. Fixed mode persistence so `lite`, `ultra`, and `fusion` survive session-list/detail transitions.
12. Added complete bounded pagination and repeated-cursor rejection for Playbooks and Secrets;
    billing and Schedule pagination now also fails instead of silently returning partial results.
13. Made the Secret response boundary strict metadata-only and added a regression proving an
    unexpected `value` field is stripped before it can reach cache or UI.
14. Corrected Secret nullability and access-type enums to the published response contract.
15. Corrected ACU-limit parsing to require the published scope and nullable organization/user IDs.
16. Added the Knowledge pinned-repository field and corrected nullable enable-state behavior.
17. Added bounded, self-contained Playbook structured-output schema editing and external-`$ref`
    rejection.
18. Added documented Schedule platform selection and parsed the full current response shape while
    withholding privilege-bearing controls.
19. Required explicit time bounds for active-user metric calls, matching the OpenAPI requirement.
20. Removed raw 4xx response-body retention from the shared API client and added a non-disclosure
    regression test.
21. Updated the live ACP baseline to the installed CLI version and recorded that elicitation/model
    behavior remains capability- and runtime-dependent rather than universally promised.
22. Made session-message and tag-update payloads strict and validated session-list query parameters
    before URL construction, preventing undocumented keys from crossing the network boundary.
23. Aligned Knowledge, Playbook, Secret, and active-user response schemas with every field required
    by the published OpenAPI instead of accepting undocumented partial or wrapped responses.
24. Ensured the shared API timeout is always cleared after success, rejection, or abort rather than
    leaving a timer alive after failed requests.
25. Added dedicated-Keychain support to the Connector notarization workflow and verified the actual
    Developer ID identity plus `devinx-notary` profile without copying credentials or submitting an
    artifact.

## Deliberate omissions — not missing features

- Private Web requests, WebView embedding, browser session/cookie reuse, or reverse-engineered UI
  controls.
- Undocumented Cognition OAuth/headless login, PAT onboarding before GA/approval, or token
  impersonation.
- Enterprise Code Scan findings/metrics/remediation for accounts without the required documented
  authorization, and any fake scan-creation action.
- Repository indexing or Wiki generation mutation in v1, despite beta route documentation,
  because these are costly org mutations without a reviewed mobile recovery design.
- Plan purchase, invoice/credit mutation, membership/role mutation, API-key management,
  integration OAuth, custom MCP server installation, and organization-wide Devin defaults.
- Generic local shell execution, arbitrary workspace paths, arbitrary model IDs, private Desktop
  storage, or ACP capabilities the live agent did not advertise.

## Runtime-dependent behavior that must not be overclaimed

- ACP capability negotiation is authoritative per Connector runtime. The July 17 probe is a tested
  baseline, not a promise that every future CLI build advertises the same capabilities.
- `AskUserQuestion` can render a native Connector elicitation card only when the active ACP agent
  actually emits the protocol request. Prompt wording alone cannot force that behavior, so DevinX
  falls back to ordinary session text rather than fabricating a question card.
- Cloud activity descriptions beyond the stable status/session contract are opportunistic parsed
  fields. When absent, the UI uses the truthful generic “Devin working” label.
- Account tier, preview flags, and RBAC remain server-authoritative. A control can be correctly
  implemented and still be unavailable for a particular credential.

## Automated release evidence

The final results recorded after all corrections are listed below. This audit did not create,
upload, or submit an iOS archive.

- ESLint: passed with zero warnings.
- TypeScript: passed for the app and Connector.
- Jest: 83 suites and 636 tests passed.
- App plus Connector production build: passed.
- iOS Expo export: passed (1,785 modules, 111 assets, 5.69 MB
  Hermes bytecode bundle).
- `npm audit`: passed with zero known vulnerabilities.
- Secret scan: no tracked credential material or private-key headers; intentionally synthetic
  values exist only in credential/scrubber tests.
- Connector artifact: arm64 ad-hoc build and deterministic artifact verification passed with
  bundled Node `24.18.0` and SHA-256
  `6618fdb0827dc060a94eb8ce4ad7293c960c7ce37e17ebfaea27d751b4f58d8c`; the
  release identity/profile readiness check passed using the dedicated build Keychain. No
  notarization submission or public artifact publication occurred in this audit.

Physical-device validation remains necessary for camera pairing,
Tailscale-away-from-LAN behavior, microphone/interruption/AirPods paths, keyboard avoidance,
external TestFlight install, and real-account permission/tier variations. Those are release tests,
not unimplemented API parity.

## Official sources

- <https://docs.devin.ai/api-reference/authentication>
- <https://docs.devin.ai/api-reference/release-notes>
- <https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions>
- <https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session-attachments>
- <https://docs.devin.ai/api-reference/v3/metrics/organizations-metrics-mau>
- <https://docs.devin.ai/api-reference/v3/notes/post-organizations-knowledge-notes>
- <https://docs.devin.ai/api-reference/v3/playbooks/post-organizations-playbooks>
- <https://docs.devin.ai/api-reference/v3/schedules/post-organizations-schedules>
- <https://docs.devin.ai/api-reference/v3/secrets/organizations-secrets>
- <https://docs.devin.ai/api-reference/v3/repositories/list-organizations-indexed-repositories>
- <https://docs.devin.ai/work-with-devin/devin-mcp>
- <https://docs.devin.ai/cli/reference/commands>
- <https://docs.devin.ai/cli/models>
- <https://docs.devin.ai/cli/adaptive>
- <https://docs.devin.ai/cli/handoff>
- <https://docs.devin.ai/cli/acp/jetbrains>
- <https://docs.devin.ai/desktop/devin-local>
- <https://docs.devin.ai/desktop/agent-command-center>
