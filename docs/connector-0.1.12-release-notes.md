# DevinX Connector 0.1.12 — Local session controls and pairing identity

## Fixed
- Activity timeline support from #90: bounded activity logs, thought entries, tool titles, diffs, output, running/idle liveness, and a performance fix for local session updates.
- Questions and command approvals from the phone from #91, with safe decisions only, a 10-minute timeout, and TUI sessions remaining read-only.
- Presentation capabilities from #92, including message timestamps and live permission grants.
- Pairing offers now include the Connector computer name when available, so the iPhone can identify the local device during pairing.

Older DevinX apps continue to pair and work because these capabilities are negotiated and the new offer field is optional.

## Includes
- 0.1.11: local session list refresh fixes and dependency audit gate updates.

Pairing, permissions and networking are otherwise unchanged; existing pairings are preserved when replacing the app in Applications.

Apple Silicon macOS 13 or newer. Developer ID signed, Apple notarized and stapled.

Source: <filled in at publish time>.
SHA-256: `<filled in at publish time>`.
