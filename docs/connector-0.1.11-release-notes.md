# DevinX Connector 0.1.11 — Local session list refresh fix

## Fixed
- New Devin CLI sessions no longer go missing from the iPhone Sessions list. The Connector rate-limited `session.list` per page instead of per listing, so with ~150+ sessions a few pull-to-refreshes plus the 30 s poll hit `429 rate_limited`; the phone then kept the stale list and showed a misleading offline notice. Continuation pages now have their own limit and rate-limited/busy results are reported as busy (#85).
- Windows connector NuGet lockfiles refreshed (#86).
- Dependency audit gate matches advisories by GHSA and fails closed on widened ranges (#86, #87).

## Includes
- 0.1.10: always-visible Check for updates / Download update actions and manual install guidance (#83).

Pairing, permissions and networking are unchanged; existing pairings are preserved when replacing the app in Applications.

Apple Silicon macOS 13 or newer. Developer ID signed, Apple notarized and stapled.

Source: <filled in at publish time>.
SHA-256: `<filled in at publish time>`.
