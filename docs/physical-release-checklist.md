# Final internal TestFlight physical checklist

Use the next iPhone-only TestFlight Build 67 for final release acceptance and sanitized App Store
screenshot validation. Build 66 remains historical signed evidence but advertises unvalidated iPad
support, so it is not the initial public-release target. Build 67 preserves Build 65's owner-accepted
onboarding and assisted Connector setup flow and contains the single
active **Devin working** companion caption with no timeline activity block (`8b2484b`), plus a
keyboard-safe **Name this Mac** flow that keeps its field and pairing controls reachable (`0c81638`).
It must preserve composer correction `d90fbb7`, keyboard-viewport fix
`791a338`, the supported Settings/MCP/Wiki capability boundary recorded in release-source commit
`4825409`, final Cloud/Computer model-contract enforcement `3162a33`, truthful session activity
`0907d2b`, the owner-supplied Home companion artwork correction `e21c8c9`, and explicit session
keyboard dismissal `af05c98`. Release-source commit `b0c7dcc` adds verified bundled model-family
marks without changing live Cloud or ACP model IDs, and `b0aad7e` simplifies the Home readiness
header without changing connection behavior.
Build 66 preserves the combined connection path as two explicit steps: authenticate Devin Cloud,
then pair the optional computer. It does not imply that Cloud authentication automatically pairs a Mac.
It also makes the guarded AI-assisted setup prompt the primary Computer path, preserves an explicit
already-installed route, keeps the Connector runtime in a visible menu-bar item after its window closes,
and offers an honestly labeled local-only iPhone removal when the Mac is unreachable. The setup prompt
must stop safely until the official release has a Developer ID signature, notarization, and adjacent
checksum.
Use only sanitized sessions, repositories, and prompts.
Record pass/fail evidence without credentials, private paths, session identifiers, QR payloads, or
customer content.

Before testing, confirm TestFlight shows the exact build number and release-source commit recorded
in `docs/release-readiness.md`. Do not test an older installed build merely because it remains in
the internal group.

Owner acceptance note (July 14, 2026): Mark physically verified the Build 65 onboarding and assisted
Connector setup flow and reported that it works. This evidence covers onboarding/setup only; the
remaining physical, screenshot, stability, and App Review gates below are not implied to have passed.
Build 67 requires a narrow visual/setup-link spot-check before the prepared iPhone screenshots are
uploaded.

Build 67 delivery note (July 14, 2026): Apple processing completed and Mark installed `0.1.0 (67)`
from TestFlight on a physical iPhone. This closes the binary delivery/install gate only; use the
installed Build 67 for every remaining check below.

## Launch, navigation, and appearance

- Cold-launch once in light mode and once in dark mode. Confirm the transparent DevinX wordmark
  has no rectangular background or color flash.
- Open every primary navigation and supported Settings row. Confirm Security Work is native and that no
  private Devin Web login, unsupported Code Scan dashboard, or dead route appears.
- On **Connect your Mac**, focus **Name this Mac** on a small iPhone. Confirm the field and Scan
  button can scroll above the keyboard, the typed name remains visible, dragging and Done dismiss the
  keyboard, and neither path clears the name.
- Starting from the Computer or Cloud + Computer onboarding choice, confirm **Send assisted setup
  prompt** opens the iOS share sheet with the guarded prompt, **Open official releases** resolves only
  to `github.com/fenner888/Devinx/releases/latest`, and **Already installed? Continue below** reaches
  pairing without claiming that the Connector was installed automatically.
- With the Mac available, confirm **Disconnect** completes signed Mac-side revocation before local
  credentials disappear. With the Connector intentionally unavailable, confirm the fallback explicitly
  says the inactive Mac record remains and **Remove from this iPhone** deletes only the iPhone-side
  credential and device key.
- Open **Connections & MCP** in Cloud or Cloud + Computer mode. Confirm the read-only Integrations
  and MCP catalogs load or show an honest permission state, contain no Install/Configure/OAuth
  action, and are absent in Computer-only mode.
- Confirm Security Work shows only sessions whose root origin is `code_scan`; ordinary API sessions
  remain absent even when their title, prompt, category, or tags mention security.
- Check Home, Sessions, Cloud session, Computer session, Usage, Repositories & Wiki, Knowledge,
  Playbooks, Automations, Review, Analytics, Secrets, Privacy, connection management, and scanner
  in both themes.
- Enable Larger Text/Dynamic Type and confirm critical actions, sheets, editors, and composer
  controls remain readable without clipped meaning or unreachable actions.
- Enable VoiceOver and verify useful names and reading order for navigation, rows, editors,
  destination/repository/workspace/model pickers, mic/stop/cancel, Send, scanner, and Devin status.
- Enable Reduce Motion and confirm the companion and voice level display become non-traveling or
  static while text/status still communicates state.
- In both a Cloud session and Computer session, focus a non-empty draft, tap **Hide keyboard**, and
  confirm the keyboard closes without clearing the draft. Reopen it, drag the timeline downward,
  and confirm interactive dismissal also preserves the draft.
- On Home with a Computer selected, open the local model picker and confirm Adaptive/Fusion,
  Claude, GLM, SWE, GPT, Gemini, DeepSeek, and Grok choices use their recognizable family marks at
  the leading edge, while selection and truthful promotion labels remain trailing.
- Repeat the model-picker check in an existing Computer session. Confirm choosing a model updates
  the compact composer mark, unknown live ACP families use the neutral fallback, and a harmless
  prompt still submits the exact selected model/variant rather than a display-derived alias.

## Cloud products and session lifecycle

- Confirm the Cloud mode picker exposes only Normal and Fast. Create one harmless Fast session only
  if the test organization makes Fast available; verify the session starts successfully rather than
  treating the picker as display-only. Do not expect Fusion from the public API: the reviewed v3
  contract does not accept it.
- In Cloud mode, load Usage & Limits and confirm either documented organization data or an honest
  permission/unavailable state—never a raw API response.
- Open Repositories & Wiki; search, inspect indexing states, open one indexed repository, read its
  documentation structure, load full documentation, and ask one sanitized question. Confirm no
  Generate, Regenerate, Add repository, or indexing mutation is offered.
- In Knowledge, filter by folder, create a disposable note in a folder, edit it, disable/enable it
  if available, then delete it after confirming the destructive action.
- In Playbooks, create a disposable playbook with a valid `!macro`, edit it, use/search it from the
  supported picker, then delete it.
- In Automations, create one disabled recurring automation and one disposable future one-time
  automation with notification, agent, playbook, and tags. Toggle, edit where supported, then
  delete both.
- Select and upload a sanitized photo/file attachment; cancel once, retry once, and confirm an
  invalid or unavailable selection does not expose an OS/API error body.
- Create a Cloud session, send a steering message, refresh, archive a sleeping/completed session,
  and terminate only a disposable active session after the confirmation prompt.

## Computer sessions, ownership, and device authorization

- In DevinX Connector, grant the test iPhone read, send, and create-session permissions.
- Create a Computer session from the phone with an approved opaque workspace and selected live
  model/variant. When Adaptive is present in the live catalog, select it explicitly. Confirm the
  selected exact model appears, is accepted by Devin for Terminal, and the initial prompt receives
  one reply.
- Open that phone-created session in Devin Desktop after the turn settles, then send a later phone
  turn and confirm ownership can alternate without a permanent unavailable state.
- Confirm bounded local history remains chronological and no raw Mac path or raw ACP identifier is
  rendered.
- Remove the Mac on iPhone and confirm access disappears. Re-pair with a fresh QR, revoke the iPhone
  on the Mac, and confirm the phone loses access through the generic unavailable path.
- Cold-launch Cloud only, Computer only, and Cloud + Computer. Confirm each mode persists and shows
  only the intended origins without duplicates.

## Composer and companion

- With short and long Cloud and Computer histories, scroll content behind Devin. Confirm the pet
  stays immediately above the composer as a transparent pointer-free overlay. Confirm conversation
  content is visibly present behind the translucent floating composer and its final line can scroll
  completely above both overlays without a black bar, blank dock, clipping, or intercepted tap/scroll.
- Send a new Cloud session and a new Computer session. Confirm Devin transitions promptly into the
  active walking/working animation, travels without gliding, then stops smoothly at the terminal
  state.
- Confirm passive status text is absent when no task is active; when active, any task/status text
  remains attached to the companion and never blocks history or controls.
- Open the keyboard in both session types. Confirm the composer stays visibly above the keyboard,
  the existing conversation does not disappear into blank clearance, and sending dismisses the
  keyboard while composer controls remain above the safe area.

## Dictation and Organize prompt

- On Home, an existing Cloud session, and an existing Computer session, mix typing and dictation at
  the cursor. Confirm finalized text appears once and typed text is not replaced.
- Confirm the mic sits beside Send, recording shows one visible Stop action plus Cancel, and the
  on-device indicator remains visible for the entire recording.
- Stop one recording, cancel one recording, and background/interruption-stop one recording. Confirm
  partial text is preserved as designed and the microphone is no longer active.
- After at least 15 dictated words, open **Organize prompt**, compare raw/structured versions, keep
  raw once, apply structured once, edit it, and send it.
- Deny microphone permission, follow the Settings recovery action, grant it, and retry without a
  repeated or onboarding-time prompt.
- Test built-in microphone and AirPods/Bluetooth route changes, a phone-call/Siri interruption,
  VoiceOver, Switch Control if available, Reduce Motion, and a recording longer than five minutes
  to confirm its warning haptic.

## Pairing scanner and privacy

- Open the QR scanner in both themes. Confirm the camera is immediately visible without scrolling,
  the frame is neither full-screen nor narrow, Cancel remains reachable, and backgrounding stops
  capture.
- Confirm Settings → Privacy says voice is processed on device and audio never leaves the phone.
- Disconnect/wipe app data, cold-launch, and confirm Keychain credentials, paired computers, caches,
  drafts, templates, and remembered session context are gone.

## macOS Connector lifecycle

- Use the final Developer ID-signed/notarized Connector on a clean non-admin macOS account. Confirm
  first launch, QR pairing, explicit launch-at-login enablement, logout/login startup, and repair
  after stopping Tailscale or Devin for Terminal.
- Close the Connector window and confirm its menu-bar item and mobile bridge stay available. Reopen
  the window from the menu-bar item, then choose **Quit DevinX Connector** and confirm the bridge
  stops.
- With Connector offline, confirm mobile disconnect offers retry or clearly labeled local-only
  removal. Reopen Connector later and revoke the inactive iPhone record from the Mac.
- Quit the Connector, replace it with the newer official signed DMG, and confirm its stable identity
  preserves approved device state without a new Keychain prompt or silent permission expansion.
- Perform uninstall last: confirm the destructive warning, then verify the listener stops, launch at
  login is removed, the app moves to Trash, and the old iPhone grant no longer reaches the Mac.
  Reinstall and confirm fresh QR pairing is required. Never run this step against the only copy of a
  production credential or before other Connector checks are recorded.

## Performance and stability

Complete `docs/physical-performance-checklist.md` against this same build: five cold launches per
connection mode, 200-row release-mode scrolling, one-hour foreground battery, and the seven-day
internal TestFlight stability window.

## Final owner design gate

- After every functional, security, privacy, Connector, performance, and stability gate above is
  resolved, stop before App Review. Mark supplies the final design-review details.
- Implement the approved visual changes, repeat affected theme/accessibility/composer checks, and
  obtain Mark's explicit UI freeze approval on the resulting TestFlight build.
- Capture App Store screenshots only after that approval. A prior internal build, passing automated
  checks, or completed metadata is not permission to submit App Review.
