# Security Work and Enterprise Code Scans

Status: genuine Code Scan session discovery implemented; mobile Code Scan creation deferred
pending a supported user-principal create route

## Objective

Provide a useful, completely in-app view without pretending that ordinary Devin sessions are
platform Code Scans. **Security Work** groups only platform-generated sessions whose canonical
origin is `code_scan` with their returned child agents, then exposes their existing work logs and
PR/status state.

The product must never redirect users to a second Devin login, consume browser cookies, call a
private web endpoint, or label inferred session data as an official Code Scan finding.

## Observed Pro/Max Web Code Scan workflow

Code Scan availability in Devin's paid Web product is distinct from the documented enterprise API
surface. A signed-in Pro/Max user can open **Security** at `/org/{org_slug}/code-scan`, select
**Start scan**, and use the **New Scan** form to choose one repository or all repositories, an
optional scan profile, an optional repeat schedule, and Interactive mode before submitting
**Run Scan**. Existing rows are labeled **Created by you** and open
`/org/{org_slug}/code-scan/{scan_id}`.

The verified `fenner888/Push` example produced a genuine scan record, linked orchestrator session,
interactive threat-model approval, investigation child sessions, and aggregated findings. Its
orchestrator begins with the human-facing message `Perform a security scan on fenner888/Push.`, but
that message alone is not evidence that a normal service-user-created session invokes the same
private Web workflow; it may be the audit message synthesized by the scan form.

DevinX v1 authenticates Cloud requests with a service-user key, optionally using
`create_as_user_id` for attribution. Attribution does not change the authenticating principal. The
mobile app therefore must not submit the natural-language scan command through `ServiceUserAuth`
and claim an official Code Scan. PATs would authenticate as the human user, but they remain closed
beta and the public API still documents no create-scan endpoint. Until Devin exposes a supported
user-principal create route, DevinX may discover genuine scan sessions but may not create or
simulate one.

## Supported public workflow

The organization Sessions API exposes the fields DevinX needs:

- `category`, including `code_quality_and_security`;
- `origin`, including the observed `code_scan` compatibility value;
- `parent_session_id` and `child_session_ids` for coordinator/worker relationships;
- session title, status, update time, tags, messages, and pull requests; and
- normal organization session creation through the existing authenticated provider.

Security Work therefore:

1. Includes only top-level sessions whose canonical origin is exactly `code_scan`. Titles,
   categories, natural-language prompts, and client-applied tags are never substitutes for the
   server-provided origin.
2. Recursively includes returned child sessions beneath a matching coordinator, even before a
   child receives its own category or tag.
3. Opens coordinator and worker logs through the existing native Session Detail route, preserving
   its authorization, polling, steering, redaction, and message validation behavior.

The native layout uses normal application surfaces: a concise explanation, verified scan groups
with live canonical status, agent count and PR count, and expandable child-agent rows. Every row
opens a native session. Empty, loading, error, and refresh states remain explicit. There is no
**New review** action because the supported Sessions API cannot create origin `code_scan`.

## Enterprise enhancement boundary

The documented Devin v3 API additionally supports:

- `GET /v3/enterprise/code-scans/metrics`;
- `GET /v3/enterprise/code-scans/findings`; and
- `POST /v3/enterprise/organizations/{org_id}/code-scans/{scan_id}/findings/{finding_id}/remediate`.

Findings link to both `orchestrator_session_id` and `session_id`, confirming that Code Scan work
uses Devin sessions. The finding record still contains separate scan-specific data—`scan_id`,
severity, evidence snippets, recommendation, and resolution state—which ordinary session responses
do not provide. All three endpoints require enterprise code-scan permissions. There is no documented
public create-scan endpoint.

Consequently, public Security Work is not a severity dashboard and cannot claim scan completeness.
Real metrics, findings, evidence, and remediation may be layered onto the same screen only when the
current authenticated provider has a documented supported code-scan grant. The public route must
remain fully useful without that enhancement.

## Security gates

- Every API response continues through the existing Zod boundary.
- Session IDs, titles, repositories, logs, findings, and prompts are never logged or sent to
  analytics/crash diagnostics.
- A missing Code Scan permission exposes no enterprise resource details.
- A missing or undocumented endpoint must never be replaced with a guessed request, browser cookie,
  private web route, or Connector/CLI scrape.
- Protected session reads and writes retain their server-side organization authorization. Client
  filtering controls presentation only and is not treated as a security boundary.

## Validation

- Unit tests cover exact `code_scan` root classification, false-positive avoidance, parent/child
  closure, grouping, ordering, and cycles/missing children.
- Component tests cover navigation discoverability, empty/list/expanded-agent states, rejection of
  tagged ordinary sessions, absence of scan-creation controls, and computer-only behavior.
- Existing Session Detail tests continue to cover authorized logs and steering.
- Run lint, strict TypeScript, all unit/component tests, dependency audit, secret scan, and the
  authorization matrix before release.
- Physical QA covers light/dark appearance, VoiceOver, Dynamic Type, refresh, opening genuine
  coordinator/child logs, and companion movement after navigation.

## Scan-camera release gate

Security Work is unrelated to the native QR pairing scanner. The release candidate must still
physically verify the QR camera preview in both themes: immediately visible without scrolling,
neither full-screen nor narrow, accessible Cancel control, safe permission-denied route, and capture
stopped on cancel/background/removal.
