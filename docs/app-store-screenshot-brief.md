# App Store screenshot brief

Approved direction: July 13, 2026

This brief defines the first public DevinX screenshot set. Capture only from the final screenshot
candidate using fictional, sanitized review data. Do not include credentials, QR payloads, raw
computer paths, private repository names, customer content, real-person identifiers, or invented
features and metrics.

## Product story

The six images tell one sequence:

1. Connect and begin from anywhere.
2. Monitor Cloud and Computer work together.
3. Respond when a session needs a human decision.
4. Speak a substantial task instead of typing it with thumbs.
5. Review the resulting changes and pull request.
6. Inspect and steer genuine Code Scan work.

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

## Image 2 — Combined session board

**Headline:** `Cloud and computer. One view.`

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

## Image 4 — Voice and prompt organization

**Headline:** `Speak the task. Send the plan.`

**Supporting line:** `Turn a spoken idea into an editable work order.`

Show the real new-session composer during on-device dictation or the real Organize Prompt preview.
The transcript should be a realistic technical task. Keep the microphone state, timer, Cancel/Stop,
and on-device language visible when capturing the recording state. Do not call the guaranteed
deterministic organizer a cloud LLM.

## Image 5 — Result and pull request

**Headline:** `From prompt to pull request.`

**Supporting line:** `Review results, changes, tests, and linked pull requests.`

Show a sanitized completed Cloud session on the Changes tab, or the strongest real completion state
that visibly includes its summary and linked PR. Any counts must match the captured session. Do not
invent files changed, tests passed, or PR state in the marketing composition.

## Image 6 — Security Work

**Headline:** `Review security work anywhere.`

**Supporting line:** `Inspect Code Scan sessions, agent activity, and findings.`

Show only a genuine `origin = code_scan` Security Work root. Prefer a detail view with a readable,
sanitized report and visible follow-up composer; use the grouped Security Work screen only when its
root and child-agent structure communicates more clearly at App Store size. This image represents
review and steering of existing Code Scan sessions, not scan creation or Cognition's enterprise
findings dashboard.

## Required export sets

The authenticated App Store Connect media manager currently requests:

- iPhone 6.5-inch portrait: `1284 × 2778` or `1242 × 2688` PNG.
- iPad 13-inch portrait: `2064 × 2752` or `2048 × 2732` PNG.

Create all six images for both families. Do not stretch an iPhone capture into the iPad artwork;
capture and compose the real iPad layout independently.

## Capture acceptance gate

- Capture from the exact final internal build selected for screenshots.
- Confirm the device is in dark appearance before every capture and visually verify that the app
  background and final marketing canvas are black. Any light-mode capture fails this gate.
- Complete the relevant dark-theme, Dynamic Type, VoiceOver, keyboard, dictation, session, and
  Security Work checks in `docs/physical-release-checklist.md` before capture.
- Verify every repository, session title, prompt, message, PR, count, and status is fictional and
  internally consistent.
- Confirm all copy remains accurate to the supported API and Connector boundaries.
- Obtain owner approval on the full iPhone and iPad contact sheets before uploading them.

## Final capture intake

Use internal TestFlight Build `0.1.0 (64)` for every authenticated source capture. Submit the
original PNG produced by iOS; do not send a messaging-app recompression, crop, mockup, or image with
markup. Keep dark appearance, standard text size, a clean status bar, and the same sanitized review
account across the set.

Name the six iPhone sources:

1. `01-home.png`
2. `02-sessions.png`
3. `03-needs-input.png`
4. `04-voice-or-organize.png`
5. `05-result-pr.png`
6. `06-security-code-scan.png`

Repeat the same states on the 13-inch iPad using `01-home-ipad.png` through
`06-security-code-scan-ipad.png`. The Security Work source must visibly belong to a genuine
`origin = code_scan` root. If a suitable sanitized state does not exist, omit that shot rather than
substituting an ordinary security-review session.

Before composition, verify each source against its image section above. After composition, export
the iPhone set at `1242 x 2688` and the iPad set at `2048 x 2732`, generate one contact sheet per
family, and obtain owner approval before uploading either set.
