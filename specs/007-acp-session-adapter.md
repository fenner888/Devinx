# Phase 3D — ACP Session Discovery Adapter

> Historical phase note: the read-only limitation in this document is superseded by
> `024-concurrent-local-continuation.md`, which specifies the reviewed SQLite history
> adapter and explicit `session/new` continuation path.

Status: synthetic-fixture implementation. Real-account invocation remains an explicit user checkpoint.

## Purpose

Provide the production Desktop Bridge with a supported, validated adapter for ACP initialization and read-only `session/list` without parsing Devin CLI or Desktop private storage.

## Process boundary

- The configured Devin executable must be an absolute local path.
- The adapter always spawns exactly that executable with the single fixed argument `acp` and `shell: false`.
- Phone requests can never set the executable, arguments, working directory, or environment.
- The child starts from the user's absolute home directory rather than inheriting a possibly malicious repository working directory.
- The child receives an allowlisted environment only. API keys, bridge keys, pairing secrets, signed requests, test secrets, and arbitrary parent variables are excluded.
- Stderr is drained but never stored or logged.
- Initialization requests ACP wire version `1` with empty client capabilities.
- `session/list` is sent only after initialization advertises `sessionCapabilities.list`.

## Boundary validation

Every JSON-RPC line, initialization result, list request, and list result is parsed with Zod. The adapter:

- bounds individual JSON-RPC messages;
- bounds unmatched notifications/requests;
- applies per-request timeouts;
- rejects invalid protocol versions and missing capabilities;
- requires non-empty session IDs and absolute workspace paths;
- validates optional additional directories, titles, ISO timestamps, metadata shape, and opaque pagination cursors;
- rejects duplicate session IDs within a page;
- tolerates unknown fields but does not forward them; and
- terminates the child after malformed or timed-out protocol traffic.

## Data minimization

The internal adapter returns only the standard session fields required for later policy handling:

- session ID;
- working directory;
- optional additional directories;
- optional title;
- optional updated timestamp; and
- optional next-page cursor.

ACP `_meta` and unknown extension fields are validated at the boundary but dropped. The adapter never logs session values or raw messages. A later authorized bridge handler must still decide whether titles or full paths are disclosed to a particular paired device; adapter validation is not authorization.

## Deliberately unsupported

- `session/load`
- `session/new`
- `session/prompt`
- permission responses
- cancellation, close, delete, fork, resume, or handoff
- hooks, MCP configuration, filesystem, terminal, or attachment surfaces

These operations require separate capability, permission, validation, and real-device gates.

## Exit criteria

- Synthetic CLI proves fixed arguments and safe environment behavior.
- Capability absence prevents `session/list` from being sent.
- Valid metadata is parsed and private/extension metadata is dropped.
- Relative paths, invalid metadata, duplicate IDs, malformed JSON-RPC, oversized messages, and timeouts fail closed.
- Shutdown clears pending requests and leaves no child process running.
- Root CI and bridge compilation remain green.
