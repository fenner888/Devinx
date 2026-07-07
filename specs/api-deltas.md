# Devin API — Live Docs vs. Build Spec Deltas

> Source: `https://docs.devin.ai/llms.txt` + crawled v3 API reference, 2026-07-07.
> Compared against build spec §2.3 (API facts) and §8.5 (endpoint coverage).

## Summary

The spec's §2.3 field list is **accurate** — every field it names exists in
v3. The deltas below are additions, missing endpoints, and one notable
removal. **No spec assumption was found to be wrong about a field that DOES
exist**; the spec is a strict subset of the live API.

## Confirmed (spec assumptions that match live docs)

- Base URL `https://api.devin.ai/v3/organizations/{org_id}/...` ✅
- Auth: `cog_`-prefixed service-user keys, `Bearer` token ✅
- `create_as_user_id` requires `ImpersonateOrgSessions` permission ✅
- PATs in closed beta / "coming soon" — NOT currently available ✅
- No streaming, no webhooks → polling architecture ✅
- Cursor pagination on messages (and on every list endpoint) ✅
- 429 rate limits documented → backoff + jitter required ✅
- Session create fields all present: `prompt`, `playbook_id`, `snapshot_id`,
  `knowledge_ids`, `secret_ids`, `session_secrets`, `tags`, `title`,
  `max_acu_limit`, `structured_output_schema`, `unlisted`, `create_as_user_id` ✅
- v3 session responses include `origin`, `category` ✅ (and `subcategory`)
- Attachments upload + download endpoints exist ✅
- Consumption: daily endpoint exists ✅

## Deltas — additions the spec didn't mention

### D1. `devin_mode` field on session create
Live v3 exposes `devin_mode: 'normal' | 'fast'` (`fast` ≈ 2x faster, 4x more
expensive). Spec §2.3/§8.5 didn't list it. **Action:** added to types +
schemas. Composer (§7.5) can surface it in "Advanced" as a follow-on; not
required for v1 MVP but the type is ready.

### D2. `attachment_urls` on session create AND message send
Both `POST /sessions` and `POST /sessions/{id}/messages` accept
`attachment_urls: string[]` (URIs, max 2083 chars). Spec §7.5 mentions
attachments for the composer but didn't specify the create-body field.
**Action:** added to both request schemas.

### D3. `bypass_approval` and `child_playbook_id` on session create
Live v3 exposes both. Not in spec. **Action:** added to types/schemas as
optional; not surfaced in v1 UI.

### D4. `message_as_user_id` on message send
Parallel to `create_as_user_id` — attributes the user message to a human.
Requires impersonation permission. **Action:** added to
`SessionMessageCreateRequest`.

### D5. Tags endpoints: GET, POST (append), PUT (replace) — NO DELETE
Live v3 has **three** tags endpoints but **no dedicated remove**. To remove
tags, `PUT` the full desired subset. Spec §8.5 said "tags add/remove."
**Action:** `tagsRemove` is implemented as `PUT` with the subset. Documented
in `/src/api/devin/types.ts` `paths.tags`. No DELETE endpoint exists to call.

### D6. Org members list is ENTERPRISE-level (or beta org-level)
- Enterprise: `GET /v3/enterprise/organizations/{org_id}/members/users`
  (requires `ViewAccountMembership`)
- Beta org-scoped: `GET /v3beta1/organizations/{org_id}/members/users`
  (requires `ViewOrgMembership`)

Spec §8.5 listed "org members (for attribution picker, permission-gated)."
**Action:** both paths encoded in `paths.membersEnterprise` and
`paths.membersOrgBeta`. The client will try the beta org path first and fall
back to enterprise; if both 403, the attribution picker shows a free-text
user-ID field (spec §7.1 already allows this fallback).

### D7. Consumption cycles list is ENTERPRISE-level only
`GET /v3/enterprise/consumption/cycles` requires `ManageBilling`. There is
**no org-scoped** cycles list. Spec §8.5 said "Consumption: org cycle + daily."
**Action:** daily is org-scoped (`paths.consumptionDaily`) and works for v1.
Cycles list is encoded (`paths.consumptionCycles`) but gated behind
enterprise permission; the Usage screen (§7.6) shows a graceful locked state
if the key lacks `ManageBilling`, exactly as spec §7.6 prescribes for
missing consumption permission.

### D8. Insights response is richer than spec implied
Live `GET /sessions/{id}/insights` returns a full `analysis` object with
`action[]`, `classification`, `issues[]` (with severity), `prompts[]`,
`timeline[]`, plus `session_size` (`xs`–`xl`) and message counts. Spec §7.3
just said "session insights." **Action:** full schema encoded.

## Deltas — spec assumptions NOT confirmed by live docs

### D9. `idempotent` parameter on session create — DOES NOT EXIST in v3
Spec §8.4 said: *"an `idempotent: true` param exists on session create — use
it to make retry-safe creates."* **This is not present in v3.** It was a
v1/v2 feature. **Action:** `idempotent` is NOT in `SessionCreateRequest` or
its schema. The client must implement retry-safe creates by treating a
network-error-after-send as a potential duplicate: on retry, first list
sessions filtered by `search` on the prompt prefix / title to detect an
already-created session before re-POSTing. This logic lives in the
`useCreateSession` query hook (Session 1). **This is a real behavioral
change from the spec — flagging for Mark.**

### D10. v3 status enum ≠ v1 status enum ≠ web-app display labels
The build spec §5.1 fallback used `working / blocked / finished / sleeping /
failed` as status names. The **API** uses a two-level model:
- `status` (lifecycle): `new | claimed | running | exit | error | suspended | resuming`
- `status_detail` (sub-state): `working | waiting_for_user | waiting_for_approval | finished | inactivity | user_request | usage_limit_exceeded | out_of_credits | out_of_quota`

The **web app** computes a human `displayName` from a richer state machine
(see `/specs/design-tokens.md` §2.3) using fields like
`latest_status_contents`, `latest_permission_contents`, `latest_loop_contents`,
`latest_approval_contents`, and PR state. The display labels
(`Working`, `Waiting for response`, `Exceeded limit`, `PR is ready`,
`Sleeping`, `Crashed`, `Done`, etc.) are NOT raw API enum values — they are
derived. **Action:** `SessionResponse` type includes the enrichment fields
(best-effort optional); `tokens.ts` exports the exact `statusLabels`
vocabulary; a `deriveStatusLabel(session)` helper will be implemented in
Session 2 to mirror the web app's state machine. The mobile app shows the
web-app labels, never the raw enum strings.

### D11. v1 fallback status enum (for reference)
Spec §2.3 said "v1 (`/v1/sessions`) remains available; use v3 as primary."
The v1 `status_enum` field uses a different vocabulary: `working | blocked |
expired | finished | suspend_requested | suspend_requested_frontend |
resume_requested | resume_requested_frontend | resumed`. **Action:** v1 is
not implemented in Phase 0; if a v1 fallback is needed later, a separate
v1 schema file will be added. Noted here for completeness.

## Endpoint coverage check (spec §8.5 vs. live)

| Spec §8.5 endpoint           | Live v3 path                                          | Status |
|------------------------------|-------------------------------------------------------|--------|
| Sessions: create             | `POST /v3/organizations/{org_id}/sessions`            | ✅     |
| Sessions: list               | `GET  /v3/organizations/{org_id}/sessions`            | ✅     |
| Sessions: detail             | `GET  /v3/organizations/{org_id}/sessions/{id}`       | ✅     |
| Messages: list               | `GET  /v3/organizations/{org_id}/sessions/{id}/messages` | ✅  |
| Messages: send               | `POST /v3/organizations/{org_id}/sessions/{id}/messages` | ✅  |
| Sessions: archive            | `POST /v3/organizations/{org_id}/sessions/{id}/archive`  | ✅  |
| Sessions: terminate          | `DELETE /v3/organizations/{org_id}/sessions/{id}`     | ✅     |
| Tags: add                    | `POST /v3/organizations/{org_id}/sessions/{id}/tags`  | ✅     |
| Tags: remove                 | (no DELETE — use `PUT` with subset)                   | ⚠️ D5  |
| Insights: generate           | `POST /v3/organizations/{org_id}/sessions/{id}/insights/generate` | ✅ |
| Insights: get                | `GET  /v3/organizations/{org_id}/sessions/{id}/insights` | ✅  |
| Playbooks: list              | `GET  /v3/organizations/{org_id}/playbooks`           | ✅     |
| Knowledge: list              | `GET  /v3/organizations/{org_id}/knowledge/notes`     | ✅     |
| Secrets: list                | `GET  /v3/organizations/{org_id}/secrets`             | ✅     |
| Org members                  | enterprise OR beta org (D6)                           | ⚠️ D6  |
| Attachments: upload          | `POST /v3/organizations/{org_id}/attachments`         | ✅     |
| Attachments: download        | `GET  /v3/organizations/{org_id}/attachments/{uuid}/{name}` | ✅ |
| Consumption: daily           | `GET  /v3/organizations/{org_id}/consumption/daily`   | ✅     |
| Consumption: cycle           | enterprise only (D7)                                  | ⚠️ D7  |

**Explicitly NOT called in v1 (spec §8.5):** any write to
playbooks/knowledge/secrets, any `enterprise/*` endpoint (except the members
+ cycles fallbacks above, both permission-gated), audit logs. Confirmed —
these are not wired in Phase 0.

## Open questions for Mark

1. **D9 (`idempotent` removed):** OK to implement retry-safe creates via
   "list-before-repost" detection? This is slower than a true idempotency
   token but is the only v3-compatible option. (Default: yes, implement in
   Session 1.)
2. **D6 (members):** prefer beta org endpoint first, enterprise fallback?
   Or skip the picker entirely in v1 and use free-text user ID? (Default:
   try beta org, fall back to free-text on 403.)
