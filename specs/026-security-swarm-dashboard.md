# Security Swarm Dashboard

Status: deferred from the public v1 application on July 13, 2026

The sections below preserve the reviewed enterprise implementation contract for a
future supported release; they do not authorize a route or navigation entry in the
public app.

## Objective

Make **Security** a first-class mobile workflow for Devin Security Swarm customers. DevinX must present scan health, individual swarm runs, findings, and remediation sessions in a compact native layout. It must not imply that DevinX can create a Security Swarm through an API that Devin does not publicly expose.

## Supported API boundary

The documented Devin v3 API currently supports:

- `GET /v3/enterprise/code-scans/metrics` with a bounded UTC time range;
- `GET /v3/enterprise/code-scans/findings` with cursor pagination and filters; and
- `POST /v3/enterprise/organizations/{org_id}/code-scans/{scan_id}/findings/{finding_id}/remediate`.

All three require enterprise-level code-scan permissions. There is no documented create-scan endpoint. DevinX therefore monitors and remediates natively, while **Start Security Swarm** performs an explicit handoff to Devin's authenticated product. Replace that handoff only when Cognition publishes and documents a supported write endpoint.

## Native layout

The Security screen contains:

1. A restrained Security Swarm introduction and a clearly external **Start in Devin** action.
2. A 30-day metrics summary: scans, repositories scanned, open critical/high findings, and remediation PRs merged.
3. An **Overview** section grouping returned findings by `scan_id`, showing repository, latest activity, severity summary, and open/total counts.
4. A **Findings** section with severity filters, expandable evidence/recommendation content, and remediation actions.
5. Permission, empty, loading, partial-error, refresh, and mutation feedback states.

The native dashboard is not exposed in the public v1 application. Devin's supported
code-scan API is enterprise-scoped, while Pro, Max, and Teams users may have Security
inside Devin's web product without a supported organization-level API or general user
OAuth flow. An external web handoff does not satisfy DevinX's in-app product requirement,
and private web endpoints, browser cookies, or undocumented Desktop/CLI state must not be
used to bypass that boundary. Reintroducing Security requires a supported API and auth
path that works for the intended public account tiers, followed by a fresh security and
physical-device review.

The screen uses existing theme tokens and normal application surfaces. It does not use raw colors, browser-shaped tables, or a collection of oversized floating cards.

## Security gates

- Every API response parses through a Zod schema at the client boundary.
- Metric time inputs and remediation identifiers are validated before dispatch.
- Service credentials remain inside the existing auth provider and Secure Store boundary.
- Permission failures expose no enterprise resource details.
- Finding content, code snippets, repository names, scan identifiers, and session identifiers are never logged or sent to analytics/crash diagnostics.
- Remediation remains a user-initiated write and is never retried automatically.
- A missing or undocumented create-scan API must never be replaced with a guessed endpoint.

## Scan-camera release gate

Security Swarm scan layout is separate from the native QR pairing scanner. The release candidate must still physically verify the QR camera preview in both themes: immediately visible without scrolling, neither full-screen nor narrow, accessible Cancel control, safe permission-denied route, and capture stopped on cancel/background/removal.

## Validation

- Unit tests cover the metrics schema, bounded range validation, remediation input/response schemas, and scan grouping.
- Component tests cover permission, empty, overview, findings filtering, expansion, and remediation states.
- Run lint, TypeScript, unit tests, dependency audit, secret scan, and the authorization matrix before release.
- Physical QA covers Dynamic Type, VoiceOver, light/dark appearance, and the QR camera layout.
