# Devin Companion Integration

## Objective

Integrate the generated Devin pet as a restrained, in-app React Native companion. Devin communicates real application and session state; it is not a floating system overlay, draggable decoration, or replacement for canonical status text.

## Product boundaries

- Keep Devin inside the Expo React Native layout.
- First release surfaces are Home and Session Detail only.
- Do not place Devin over navigation, the keyboard, or controls. Session activity moves horizontally in a pointer-transparent foreground overlay anchored directly above the composer. The timeline scrolls naturally behind Devin; the overlay must not reserve a blank row, push messages upward, or paint a dock/shelf background.
- Do not add a dependency or change auth, secrets, Secure Store, API clients, or endpoint schemas.
- Use existing theme tokens and exact status vocabulary from `statusLabels`.
- Keep the presentation calm and engineering-grade: no hearts, sparkles, or constant speech. Horizontal travel is reserved for active session work and stops when Devin is waiting, sleeping, finished, or in an error state.
- In Session Detail, show one compact task/status caption attached to the companion only while it communicates active work, a meaningful result, an error, or an actionable block. It travels with Devin and never becomes a centered banner. Passive idle, waiting, and sleeping states show no caption or reserved caption height.

## Source assets

Source: `/Users/frank/Documents/Pet/mobile-pets/devin`

Destination: `assets/pets/devin`

Copy:

- The nine animation frame directories below `assets/frames`.
- `assets/reference/devin-source.png`.
- Both spritesheet files as source-package references, but do not import the WebP at runtime.
- `pet.json`, `states.json`, `events.json`, `README.md`, `docs/integration-notes.md`, and `qa/contact-sheet.png`.

Do not copy `hatch-run`. Do not copy `assets/frames/frames-manifest.json`: it contains build-machine paths and generation-only chroma-key metadata. In the destination copy of `pet.json`, remove the generation-only `colors` and `framesManifest` fields so the application repository does not gain raw color literals or a reference to the excluded manifest. Do not modify the source package.

Only statically imported PNG frames are runtime assets.

## Runtime model

Create:

- `src/pets/devin/types.ts`
- `src/pets/devin/assets.ts`
- `src/pets/devin/model.ts`
- `src/components/pets/DevinCompanion.tsx`
- `src/components/pets/index.ts`

`assets.ts` statically imports every PNG frame. `model.ts` owns state-to-frame, frame-rate, default-loop, and canonical session-status mapping. Session mapping must be an exhaustive `Record<StatusLabelKey, DevinPetState>` so additions to the canonical status vocabulary fail typecheck until mapped.

Use these app-specific emotional rules:

- Working/setup/planning/coding/iterating/testing -> `working`.
- Waiting for response or approval -> `waiting` or `blocked`, rendered with the calm waiting row.
- Exceeded limit -> `blocked`.
- Crashed -> `error`.
- Done or PR ready -> `success`.
- Waiting for CI or review -> `focused` or `waiting`.
- Sleeping -> `sleeping`.
- Closed -> `waiting`.

The distressed failed row is reserved for genuine failures, hard limits, or warnings. Routine user-input and approval waits must not make Devin look broken.

## Component contract

`DevinCompanion` accepts:

- `state`
- `size`
- optional `message`
- optional `compact`
- optional `loop` override
- optional `active` flag supplied by the owning screen
- optional `travel` flag for the session's transparent horizontal walking track
- optional `travelTrack` flag that keeps the session track mounted between active states
- optional `accessibilityLabel`

Behavior:

- Cycle frames at the state's configured FPS with `setInterval`.
- Reset to frame zero only when animation state/configuration changes, not when message text changes.
- Clear the interval on cleanup and pause it while the owning screen is unfocused or the app is backgrounded.
- Respect the current Reduce Motion preference and preference changes. Show frame zero without creating an interval when reduced motion is enabled.
- When `travel` is enabled, traverse the available container width at a steady speed, use the direction-specific walking frames at their authored 8 FPS, and scale travel speed to half of Devin's displayed width per second so foot cadence stays grounded at every rendered size. Turn at each edge and disable both travel and frame cycling under Reduce Motion. Keep the session's `travelTrack` mounted before, during, and after work so Devin starts from his current edge and stops at his current position without a remount, teleport, or delayed layout pass.
- Non-looping animations stop on the final frame.
- Keep a fixed-size container and render frames with `contain` sizing.
- Make the stable outer container accessible; animated frame images are not separate accessibility elements.
- Remain non-interactive and allow touches to reach the surrounding UI.
- `compact={false}` uses the requested size and may show a subtle status message.
- Omit the status caption when `message` is absent outside Session Detail's travel track. Inside the travel track, a short state-derived fallback may describe active work or a meaningful result, but idle, waiting, and sleeping states suppress the caption even if a passive message is supplied. Never render a detached centered banner.
- `compact={true}` uses the requested smaller presentation and suppresses the message.

## Placement

### Home

Make Devin the centered visual anchor between a compact readiness card and the full-width composer. Use a responsive presentation of roughly 180–220 points so the character remains prominent without forcing controls off small screens. Home and Session Detail use the semantic `canvas` background, which is true black in dark mode and preserves the normal light canvas. Center the wordmark in the top bar, retain balanced leading/trailing space, and keep the readiness card non-interactive unless a real action is added later. Place "What should Devin build?" directly above one clean charcoal composer; do not wrap the title and composer in an additional outer card. The composer uses one compact multiline prompt area with the existing add, mode, playbook, and send controls aligned along its bottom edge; it grows for entered text but must not reserve an oversized blank block. Do not add extra control pills from visual references. The repository picker uses one grouped surface with search, flat rows, subtle separators, and a checkmark selection state; do not render every repository as a separate floating card. State is `idle` by default, `working` while session creation is pending, and `error` when `composerError` exists. Home remains centered and does not use the horizontal walking track; walking begins in the created session after navigation. Prompt text must not affect pet state or restart animation.

### Session Detail

Place a compact companion in a dedicated transparent track immediately above the session composer. The track is a stable, pointer-transparent foreground overlay at the bottom of the timeline viewport, so the conversation scrolls behind it and it consumes no opaque layout row. It must not push messages into a visible shelf, live inside the composer, intercept touches, cover controls, or paint a background. The scroll content must include enough transparent tail clearance for every response line to scroll fully above the companion and its caption. Session Detail intentionally uses a much smaller companion than Home so timeline content remains primary. Keep its transparent track mounted throughout the session. Render meaningful current activity as a small caption directly above the sprite inside the same animated wrapper; the caption moves and stops with Devin instead of remaining centered in the viewport. An optimistic send or any canonical active-work state begins walking immediately at Devin's current position without jumping to another edge. The semantic activity state and caption may distinguish thinking, editing, testing, reading, executing, responding, completion, errors, or actionable blocks, but every active state uses the direction-specific walking frames until work settles. When work ends, stop movement at the current position and transition directly to waiting, success, error, sleeping, or another canonical animation. Passive idle, waiting, and sleeping states remove the caption and its caption-height reservation. Sending immediately dismisses the keyboard so the timeline, track, and composer remain visible. Use the exhaustive canonical status mapping and canonical status label for accessibility. Keep captions task-focused and do not duplicate long header copy.

## Tests and validation

Add focused tests for:

- State-to-frame and canonical session-status mapping.
- Frame progression and FPS configuration.
- Interval cleanup.
- State reset.
- Message changes not restarting the animation.
- Non-looping final-frame behavior.
- Reduce Motion behavior.
- Directional edge-to-edge travel and keyboard dismissal after Send.

Run `npm run lint`, `npm run typecheck`, and `npm run test`. Confirm no `hatch-run` paths, raw color literals, broken asset imports, auth/API changes, or new dependencies appear in the diff.

Manual QA covers dark and light themes, Reduce Motion, keyboard open/closed, a small iPhone, a large iPhone, and iPad. Verify idle, working, waiting/blocked, success, and error without overlap or layout shifts. Include side-by-side parity screenshots for Home and Session Detail in the PR review materials.
