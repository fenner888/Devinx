# 027 — Session ownership handoff

Status: implemented and automated-test validated; physical alternating-owner validation remains

## Product requirement

A session created or continued from DevinX must become available to Devin Desktop after the active
turn finishes. Likewise, a session opened first in Devin Desktop remains readable on the phone and
may be continued through the explicit continuation path without DevinX killing, modifying, or
competing with the Desktop owner.

The expected ownership sequence is:

1. one client owns the live ACP session while a turn is running;
2. that client releases ownership only after the turn settles;
3. Devin persists the session, and either client may acquire it for a later turn; and
4. the read-only Connector history store remains available between live owners.

## ACP release strategy

The [ACP session-close specification](https://agentclientprotocol.com/rfds/session-close) defines
`session/close` behind `sessionCapabilities.close`. When the agent advertises it, DevinX
sends `session/close` for the exact loaded session and removes that session from its local loaded
set. Unknown or failed close responses fail closed by recycling the Connector-owned ACP process.

The currently installed Devin CLI does not advertise `sessionCapabilities.close`. In that case,
DevinX terminates only the ACP child process it launched after the active prompt request settles.
The Connector supervisor starts a clean ACP child for later phone operations. Terminating this child
releases every session owned by DevinX without terminating Devin Desktop, deleting locks, writing to
Devin storage, or interrupting an active turn.

Read-only ACP fallback loads and model-catalog probe loads are released immediately after their
bounded result is captured. New sessions and continuations are released only after `session/prompt`
settles. A timeout or failed prompt also releases ownership so an abandoned Connector turn cannot
lock the session indefinitely.

## Security and compatibility

- Release requests use only session IDs already validated and loaded inside the Connector.
- The phone cannot invoke process recycling or choose a process/session to terminate.
- No raw session ID, process ID, path, prompt, or release error crosses the bridge or enters logs.
- The standard close method is sent only when explicitly advertised by the agent.
- Process fallback terminates only the exact child spawned by `AcpSessionClient`.
- Bridge authorization, opaque handles, replay protection, rate limits, and history minimization are
  unchanged.

## Validation

- ACP fixtures prove advertised `session/close` is used after prompts and read-only loads.
- Fixtures without close capability prove the Connector-owned ACP child exits only after the prompt
  settles and can be recovered by the supervisor.
- Catalog discovery releases its probe ownership after copying the bounded catalog.
- Existing creation, continuation, history, authorization, and privacy suites remain green.
- Physical validation creates a session on iPhone, waits for the reply, opens it in Devin Desktop,
  then sends a later phone continuation without either client reporting a permanent lock.
