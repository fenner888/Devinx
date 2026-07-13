# Final internal TestFlight physical checklist

Use the exact newest internal candidate and only sanitized sessions, repositories, and prompts.
Record pass/fail evidence without credentials, private paths, session identifiers, QR payloads, or
customer content.

## Launch, navigation, and appearance

- Cold-launch once in light mode and once in dark mode. Confirm the transparent DevinX wordmark
  has no rectangular background or color flash.
- Open every primary navigation and Settings row. Confirm Security Work is native and that no
  private Devin Web login, unsupported Code Scan dashboard, or dead route appears.
- Check Home, Sessions, Cloud session, Computer session, Usage, Repositories & Wiki, Knowledge,
  Playbooks, Automations, Review, Analytics, Secrets, Privacy, connection management, and scanner
  in both themes.
- Enable Larger Text/Dynamic Type and confirm critical actions, sheets, editors, and composer
  controls remain readable without clipped meaning or unreachable actions.
- Enable VoiceOver and verify useful names and reading order for navigation, rows, editors,
  destination/repository/workspace/model pickers, mic/stop/cancel, Send, scanner, and Devin status.
- Enable Reduce Motion and confirm the companion and voice level display become non-traveling or
  static while text/status still communicates state.

## Cloud products and session lifecycle

- In Cloud mode, load Usage & Limits and confirm either documented organization data or an honest
  permission/unavailable state—never a raw API response.
- Open Repositories & Wiki; search, inspect indexing states, and verify the screen remains read-only.
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
  model/variant. Confirm the selected model appears and the initial prompt receives one reply.
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
  stays immediately above the composer as a transparent pointer-free overlay and never creates a
  black bar, blank dock, clipped text, or intercepted tap/scroll.
- Send a new Cloud session and a new Computer session. Confirm Devin transitions promptly into the
  active walking/working animation, travels without gliding, then stops smoothly at the terminal
  state.
- Confirm passive status text is absent when no task is active; when active, any task/status text
  remains attached to the companion and never blocks history or controls.
- Open the keyboard in both session types, send, and confirm it dismisses while composer controls
  remain above the safe area.

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

## Performance and stability

Complete `docs/physical-performance-checklist.md` against this same build: five cold launches per
connection mode, 200-row release-mode scrolling, one-hour foreground battery, and the seven-day
internal TestFlight stability window.
