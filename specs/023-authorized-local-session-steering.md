# 023 — Authorized local session steering

Status: implemented and synthetically validated; physical-iPhone prompt checkpoint pending

## Contract

An iPhone may send text to a previously listed and loaded local session only when the Mac-side device record contains `session:prompt:send`. Authenticated health reports `sessionPrompt` for the requesting device, not as a global bridge capability. Revocation or permission removal therefore removes the composer on the next health refresh and remains authoritative even if the phone's original pairing receipt is stale.

The mobile request contains only an opaque `local_` handle and bounded non-empty text. The bridge repeats signature, expiry, replay, rate-limit, permission, and optional session-scope checks, resolves the handle in memory, and sends the raw ACP session ID only to the local ACP subprocess.

## ACP lifecycle

The session must have been listed and loaded in the current ACP process before prompting. The adapter sends ACP v1 `session/prompt` with one text content block. It validates and discards streamed updates without logging or transporting tool data, and returns bridge acceptance immediately while the bounded ACP turn continues asynchronously. This prevents the iPhone's short transport request from timing out on a long Devin turn.

Only one load or prompt may be active. Unexpected session association, malformed updates, agent-to-client requests such as tool permission prompts, timeout, or process failure fail closed and stop the ACP client. Tool approval forwarding, cancellation, attachments, and parallel prompts require later specifications.

## Mobile behavior

The local session screen requests device-specific health, shows a composer only when steering is currently authorized, dismisses the keyboard on send, changes the Devin companion to working while submission is pending, and refreshes bounded text history after acceptance. It does not optimistically invent an agent response or expose raw transport errors.
