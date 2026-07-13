# Security Work and Enterprise Code Scans

Status: session-based Security Work implemented for public account tiers; enterprise Code Scan
enhancement deferred pending supported authorization

## Objective

Provide a useful, completely in-app security workflow without pretending that ordinary Devin
sessions are platform Code Scans. **Security Work** groups verified platform-generated Code Scan
roots and reviews explicitly started by DevinX with their child agents, exposes their existing work
logs and PR/status state, and launches a read-only security review through the supported
organization session API.

The product must never redirect users to a second Devin login, consume browser cookies, call a
private web endpoint, or label inferred session data as an official Code Scan finding.

## Supported public workflow

The organization Sessions API exposes the fields DevinX needs:

- `category`, including `code_quality_and_security`;
- `origin`, including the observed `code_scan` compatibility value;
- `parent_session_id` and `child_session_ids` for coordinator/worker relationships;
- session title, status, update time, tags, messages, and pull requests; and
- normal organization session creation through the existing authenticated provider.

Security Work therefore:

1. Includes only top-level sessions whose origin is `code_scan` and whose platform-generated title
   begins `Security scan `, plus sessions carrying the exact `devinx-security-work` or
   `security-review` tag applied by DevinX. Category alone, origin alone, fuzzy title matches, and
   generic `security` or `code-scan` tags are insufficient because they produce false positives.
2. Recursively includes returned child sessions beneath a matching coordinator, even before a
   child receives its own category or tag.
3. Opens coordinator and worker logs through the existing native Session Detail route, preserving
   its authorization, polling, steering, redaction, and message validation behavior.
4. Starts an explicitly read-only security review against one user-selected Cloud repository.
   The fixed work order asks Devin to coordinate child sessions where useful and report confirmed
   findings separately from hypotheses. It forbids edits, credential rotation, dependency
   installation, PR creation, and other mutations during the first pass.
5. Tags launched sessions with `devinx-security-work` and `security-review`, so the review appears
   immediately while server-side categorization is still pending.

The native layout uses normal application surfaces: a concise explanation, **New review** action,
review groups with live canonical status, agent count and PR count, and expandable child-agent rows.
Every row opens a native session. Empty, loading, error, refresh, repository-empty, and creation
failure states remain explicit.

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
- The review launch is an explicit user-initiated write through `useCreateSession`; it is never
  background-triggered or automatically retried after an ambiguous result.
- The repository comes only from the validated Devin repository response; the screen never accepts
  an arbitrary repository path.
- Optional focus text is capped at 1,000 characters before it enters the fixed work order, and the
  complete outbound request is parsed by `sessionCreateRequestSchema` before dispatch.
- The first-pass prompt is read-only. It does not install packages, change files, rotate credentials,
  open PRs, or perform remediation.
- Session IDs, titles, repositories, logs, findings, and prompts are never logged or sent to
  analytics/crash diagnostics.
- A missing Code Scan permission exposes no enterprise resource details.
- A missing or undocumented endpoint must never be replaced with a guessed request, browser cookie,
  private web route, or Connector/CLI scrape.
- Protected session reads and writes retain their server-side organization authorization. Client
  filtering controls presentation only and is not treated as a security boundary.

## Validation

- Unit tests cover verified scan-root classification, exact DevinX tags, false-positive avoidance,
  parent/child closure, grouping, ordering, cycles/missing children, focus bounds, and the read-only
  prompt contract.
- Component tests cover navigation discoverability, empty/list/expanded-agent states, repository
  selection, validated creation payload, create failure, and computer-only behavior.
- Existing Session Detail tests continue to cover authorized logs and steering.
- Run lint, strict TypeScript, all unit/component tests, dependency audit, secret scan, and the
  authorization matrix before release.
- Physical QA covers light/dark appearance, VoiceOver, Dynamic Type, refresh, creating a disposable
  read-only review, opening coordinator/child logs, and companion movement after navigation.

## Scan-camera release gate

Security Work is unrelated to the native QR pairing scanner. The release candidate must still
physically verify the QR camera preview in both themes: immediately visible without scrolling,
neither full-screen nor narrow, accessible Cancel control, safe permission-denied route, and capture
stopped on cancel/background/removal.
