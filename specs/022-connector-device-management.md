# 022 — Connector paired-device management

Status: implemented and automated-test validated; physical two-way revocation checkpoint remains

## Decision

The macOS Connector is the authoritative control surface for paired iPhones. It lists only sanitized device identity and grant state, and lets the computer owner independently grant read-only content, grant message steering, or revoke a device. Metadata discovery remains the minimum active grant.

Steering permission does not itself enable ACP prompting. The bridge advertises and accepts `session.prompt` only when the separately validated ACP handler is available and the requesting device currently holds `session:prompt:send`. This prevents a UI permission toggle from becoming an accidental capability.

## Local IPC boundary

The runtime emits a bounded `devices` snapshot containing device ID, sanitized display name, active/revoked status, pairing time, and two booleans: content read and prompt send. The native list displays the pairing time and identifies the most recent record so repeated same-name test devices remain distinguishable. It never emits public keys, endpoints, raw session scopes, credentials, messages, or audit content.

The native app may send only strict `update_device` and `revoke_device` commands. Updates always retain `bridge:health` and `session:metadata:read`; content and prompt grants are explicit independent booleans. Unknown or revoked device IDs fail closed. Every update is persisted to Keychain before a refreshed snapshot is emitted.

Revocation is immediate and server-authoritative. Subsequent protected requests from that device return the existing generic 404 authorization response. Re-pairing requires a new short-lived QR and explicit computer approval.

The iPhone may disconnect itself through the signed `device.revoke` operation. It removes the local credential and native signing key only after the Mac confirms revocation. If the Mac cannot be reached, the credential remains so the user can retry or revoke it directly in Connector instead of silently leaving an active server grant behind.

## Acceptance gates

- strict Zod validation and bounded IPC payloads;
- no secret or content fields cross native IPC;
- Keychain persistence failure leaves active authorization unchanged;
- revoked devices cannot regain permissions through an update command;
- Connector UI clearly separates read-history and send-message grants;
- automated state, IPC, controller, and macOS packaging validation.
