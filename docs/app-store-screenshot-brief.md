# App Store screenshot brief

Approved direction: July 13, 2026

This brief defines the first public DevinX screenshot set. Capture only from the final screenshot
candidate using fictional, sanitized review data. Do not include credentials, QR payloads, raw
computer paths, private repository names, customer content, real-person identifiers, or invented
features and metrics.

## Product story

The six images tell one sequence:

1. Connect and begin from anywhere.
2. Monitor active work in one clear session board.
3. Respond when a session needs a human decision.
4. Choose Cloud, Computer, or both without confusing their boundaries.
5. Review the resulting work and continue the session.
6. Choose from the live Computer model catalog.

Every screenshot uses real in-app UI at readable scale. Marketing text may explain the visible
experience but must not obscure it. Do not use Cognition's logo, Devin's official logomark, fake
floating metrics, unsupported billing values, an enterprise findings dashboard, or a claim that
DevinX creates a Code Scan through an undocumented API.

## Shared presentation

- Dark DevinX visual system only: use the app's true-black surface across every source capture and
  final composition, with restrained midnight-blue glow and the original DevinX companion.
- Reject light-mode, white, gray-canvas, or mixed-appearance captures. Do not place a dark device
  screenshot inside a white marketing background.
- Straight-on device presentation; no perspective that makes the interface difficult to read.
- One short headline and one supporting line per image.
- Small `DEVINX · INDEPENDENT CLIENT` label on each image.
- Use the same device scale, headline position, margins, and glow across the set.
- Use the Home star-field treatment primarily on image 1; later images remain quieter so content
  is legible.
- Source captures must show a clean status bar, no debug UI, no notification banners, and no
  recording or account data that is not part of the intended shot.

## Image 1 — Home

**Headline:** `Your sessions. Anywhere.`

**Supporting line:** `Start work and keep up from your iPhone.`

Show the final Home screen with the companion, readiness status, composer, `Cloud + Computer`
availability, and two or three sanitized recent sessions. The screen should immediately establish
the product without opening a picker or sheet.

## Image 2 — Session board

**Headline:** `Every session. One clear view.`

**Supporting line:** `See every session with a clear source and status.`

Show the Sessions screen with both Computer and Cloud sections visible. Include a small, believable
mix of Working, Needs input, and completed/sleeping states. Do not add a floating session-count card
unless the released UI itself computes and displays it.

## Image 3 — Human decision

**Headline:** `Keep work moving.`

**Supporting line:** `Respond from your phone when a session needs you.`

Show a sanitized Cloud session that genuinely has a needs-input state, Devin's concise technical
question, and a prepared user response in the composer. The visible response should make a concrete
decision without including secrets or production identifiers. Do not manufacture a status-transition
control that the app does not render.

## Image 4 — Connection modes

**Headline:** `Cloud, computer, or both.`

**Supporting line:** `Choose the connection that fits how you work.`

Show the real **Choose where Devin runs** screen with Devin Cloud, Computer, and Cloud + Computer.
Keep the Connector boundary visible: Tailscale supplies the private network, while the Connector
keeps computer credentials on the computer. Do not imply that Cloud sign-in automatically pairs a
computer or that the Connector installs without an explicit user action on that computer.

## Image 5 — Result

**Headline:** `Review real results.`

**Supporting line:** `Read clear summaries and continue from your phone.`

Show a sanitized session containing a readable, internally consistent result and its composer. Any
counts, links, tests, or pull-request state shown must belong to the captured session. Do not invent
files changed, tests passed, or PR state in the marketing composition.

## Image 6 — Model picker

**Headline:** `Choose the right model.`

**Supporting line:** `Use Adaptive or select from supported Devin models.`

Show the real Computer model picker populated from the live ACP catalog. Keep Adaptive, recent
families, recognizable bundled family marks, and selection state visible. Model names and promotion
badges must come from the live catalog; do not add unsupported models or claim Adaptive/Fusion exists
in the Cloud API. Capture with a clean status bar and no Dynamic Island media artwork.

## Required export sets

Build 66 still reports tablet support and therefore caused App Store Connect to request both device
families. The next candidate intentionally sets `supportsTablet: false`, so the initial release set is:

- iPhone 6.5-inch portrait: `1284 × 2778` or `1242 × 2688` PNG.

Create all six images for this iPhone family. Do not upload iPad artwork or claim iPad support in the
initial release. A later iPad release requires its own layout validation and independently captured
media.

## Capture acceptance gate

- Capture from the exact final internal build selected for screenshots.
- Confirm the device is in dark appearance before every capture and visually verify that the app
  background and final marketing canvas are black. Any light-mode capture fails this gate.
- Complete the relevant dark-theme, Dynamic Type, VoiceOver, keyboard, dictation, session, and
  model-picker checks in `docs/physical-release-checklist.md` before capture.
- Verify every repository, session title, prompt, message, PR, count, and status is fictional and
  internally consistent.
- Confirm all copy remains accurate to the supported API and Connector boundaries.
- Obtain owner approval on the full iPhone contact sheet before uploading it.

## Final capture intake

Use the prepared sanitized iPhone sources and compositions only after the iPhone-only Build 67
candidate passes its narrow visual/setup-link spot-check. Keep dark appearance, standard text size,
a clean status bar, and internally consistent sanitized review content across the set.

Name the six iPhone sources:

1. `01-home.png`
2. `02-sessions.png`
3. `03-needs-input.png`
4. `04-choose-where-devin-runs.png`
5. `05-result.png`
6. `06-model-picker.png`

Before upload, verify each composition against its image section above. Export the iPhone set at
`1242 x 2688`, generate one contact sheet, and obtain owner approval before uploading it.

Current package note (July 14, 2026): images 1–5 pass dimension and visual-content review. The
prepared image 6 is rejected because its source capture contains active Dynamic Island media artwork.
Replace image 6 with a clean simulator or device capture before final package approval; do not mask,
crop, or upload the rejected source.
