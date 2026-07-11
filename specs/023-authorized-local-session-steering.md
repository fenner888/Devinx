# 023 — Authorized local session steering

Status: implemented and synthetically validated. Build 14 physically proved Tailscale discovery, authorized prompting, keyboard dismissal, and a returned Devin reply. A same-author replay-boundary defect was then fixed in Connector and response-aware mobile polling is pending the next TestFlight build/retest.

## Contract

An iPhone may send text to a previously listed and loaded local session only when the Mac-side device record contains `session:prompt:send`. Authenticated health reports `sessionPrompt` for the requesting device, not as a global bridge capability. Revocation or permission removal therefore removes the composer on the next health refresh and remains authoritative even if the phone's original pairing receipt is stale.

The mobile request contains only an opaque `local_` handle and bounded non-empty text. The bridge repeats signature, expiry, replay, rate-limit, permission, and optional session-scope checks, resolves the handle in memory, and sends the raw ACP session ID only to the local ACP subprocess.

## ACP lifecycle

The session must have been listed and loaded in the current ACP process before prompting. The adapter sends ACP v1 `session/prompt` with one text content block. It validates and discards streamed updates without logging or transporting tool data, and returns bridge acceptance immediately while the bounded ACP turn continues asynchronously. This prevents the iPhone's short transport request from timing out on a long Devin turn.

Only one load or prompt may be active. Unexpected session association, malformed updates, agent-to-client requests such as tool permission prompts, timeout, or process failure fail closed and stop the ACP client. Tool approval forwarding, cancellation, attachments, and parallel prompts require later specifications.

## Mobile behavior

The local session screen requests device-specific health, shows a composer only when steering is currently authorized, dismisses the keyboard on send, and changes the Devin companion to working while submission is pending. After acceptance it polls bounded history within the read-rate budget until a changed Devin reply remains stable across two reads, tolerating temporary busy responses while ACP is still prompting. It does not optimistically invent an agent response or expose raw transport errors. Replay preserves private thought/tool events only as message boundaries, never as returned content, so separate no-ID user turns cannot collapse into one bubble.
