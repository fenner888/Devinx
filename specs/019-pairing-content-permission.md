# 019 — Explicit local-content permission at pairing

Status: implemented and synthetically validated; real pairing not yet invoked

## Decision

Desktop Bridge pairing remains metadata-only by default. After the Mac owner explicitly approves an iPhone, the terminal asks a separate question before creating the device record: whether that iPhone may read local session titles and message history. Only the exact answer `yes` grants `session:content:read`; every other answer preserves the metadata-only default.

This is not a general full-access option. Pairing-time choices can grant:

- bridge health;
- minimized session metadata; and
- optionally, read-only session titles and user/Devin text history.

Read permission cannot grant session prompting, approvals, tools, files, commands, attachments, archive, termination, or arbitrary ACP actions. Spec 023 adds a separate per-device `session:prompt:send` grant for bounded text-only steering; it is never implied by the content choice.

## Trust boundary

The Mac is authoritative. It creates the exact permission array, persists it in the macOS Keychain-backed device registry, and includes it in the bridge-signed pairing receipt. The iPhone verifies that receipt before storing the credential and signing any subsequent request. Every protected bridge request still repeats the server-side permission check; the mobile check is defense in depth only.

Permission prompts use a terminal-sanitized device name and never display pairing secrets, device keys, session identifiers, titles, or message bodies. A rejected, expired, interrupted, or non-explicit content choice does not gain content access.

## Existing pairings

Previously paired metadata-only devices remain metadata-only. This phase does not silently upgrade stored devices. Until a signed permission-refresh flow and desktop device-management UI are implemented, an existing device must be securely re-paired to receive the optional content grant.
