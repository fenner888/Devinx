# Phase 3E — Authenticated Bridge Dispatcher

Status: transport-independent implementation using synthetic session data only.

## Request flow

```text
transport-derived peer identity
        |
        v
pre-auth rate limit
        |
        v
Zod envelope validation -> paired-device lookup -> expiry -> Ed25519 -> replay
        |
        v
method Zod validation -> server-side grant and session scope -> device rate limit
        |
        v
allowlisted handler -> validated ACP adapter -> minimized response schema
```

No client-side state can bypass a server-side grant. Authentication, authorization, replay, and unavailable-method failures do not disclose resource existence.

## Enabled methods

- `bridge.health`: authenticated health and negotiated feature availability.
- `session.list`: authenticated, grant-gated, rate-limited, single-flight read-only discovery.

`session.load` and `session.prompt` remain schema-reserved but return 404 because their handlers and safety gates are not enabled.

## Session privacy policy

The dispatcher never returns raw ACP session IDs, absolute working directories, additional directory paths, ACP `_meta`, or unknown extension fields.

- Raw session IDs become stable, bridge-keyed HMAC handles with the `local_` namespace.
- The raw ID-to-handle map is memory-only, bounded, and expiring.
- Bridge shutdown clears the map and zeroizes the in-memory handle key.
- Default metadata permission reveals only the opaque handle, workspace basename, title presence, and update timestamp.
- The title value is included only when the device also has `session:content:read`.
- Full paths remain desktop-only in this phase.
- Pagination cursors remain opaque and are only accepted through the signed, Zod-validated request body.

Opaque handles prevent Cloud/local identifier collisions and prevent a paired phone from guessing raw Devin session identifiers. A bridge restart may require the phone to refresh the session list before an old handle can be resolved.

## Availability and abuse controls

- Rate limiting runs once per transport peer before authentication and again per authenticated device/method.
- Rate-limit state is memory-bounded and rejects new keys at capacity.
- Session listing is single-flight to bound ACP subprocess work.
- Adapter, schema, handle-capacity, or ACP failures return only `temporarily_unavailable`.
- No raw exception, path, session value, signature, key, prompt, or ACP payload is logged or returned.

## Listener gate

This dispatcher does not bind a port. The future transport must derive `peerKey` from the real connection rather than accepting it from the request body, enforce body limits before JSON parsing, and add Host, Origin, DNS-rebinding, TLS pinning, connection concurrency, and slow-client protections.
