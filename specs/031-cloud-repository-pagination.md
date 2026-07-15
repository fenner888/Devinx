# 031 — Complete Cloud repository pagination

Status: implemented, automated-test validated, and uploaded in iOS Build 34;
physical Cloud-account verification remains

## Intent

The Cloud repository picker and Computer workspace picker represent different
trust domains and must remain separate:

- Cloud lists every repository connected to the authenticated Devin
  organization.
- Computer lists only sanitized workspaces observed and approved by the paired
  Connector. It never scans arbitrary folders or exposes filesystem paths.

The Cloud picker must not silently present only the first API page as if it
were complete.

## Cloud repository contract

- Follow the Devin API's `has_next_page` and `end_cursor` fields.
- Request at most 100 repositories per page.
- Deduplicate repositories by connection plus provider repository identity
  while preserving server order.
- Reject a missing or repeated continuation cursor instead of looping or
  returning a misleading partial list.
- Bound traversal to 10 pages (1,000 repositories). If the API reports more,
  fail closed with an unavailable state rather than silently truncating.
- Parse every page through the existing Zod response schema and authenticated
  API client.

## Presentation

- Cloud continues to label this control Repository and searches the complete
  connected-repository result.
- Computer continues to label its separate control Workspace and uses opaque
  Connector handles with sanitized display names.
- No new dependency or raw filesystem-path presentation is introduced.
