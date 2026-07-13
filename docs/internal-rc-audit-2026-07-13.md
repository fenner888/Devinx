# Internal release-candidate audit — July 13, 2026

This record covers the automated release work after iOS Build 47. It authorizes neither App
Review nor a public Connector release. The authenticated product inventory and supported parity
decisions are in `specs/033-cloud-local-settings-parity.md`; route-level authorization evidence is
in `docs/authorization-matrix.md`.

## Internal candidate produced

- iOS `0.1.0 (48)` was archived from clean commit `07b7b52` with Node `24.18.0`.
- IPA SHA-256: `466829f3457b22a8b0285a7643da61bbfda2e6d37d8ea03dedb4a3145257d690`.
- Strict code-sign verification passed with `get-task-allow=false`, no APS entitlement,
  `NSFileProtectionComplete`, exempt encryption set to false, the exact on-device microphone
  disclosure, production update channel, and runtime `0.1.0`.
- All 10 packaged privacy manifests declare zero collected-data types, no tracking, and no
  tracking domains. No Sentry or notification artifact is packaged.
- EAS submission `c08b65de-0ec7-464e-acc4-aecd6c5367ae` was accepted by Apple and is processing
  in App Store Connect for internal TestFlight. No App Review or public release was submitted.

## Product surface verification

| Surface | Supported mobile behavior | Boundary | Automated evidence |
|---|---|---|---|
| Usage & Limits | organization consumption, ACU limits, and permission-gated metrics | self-serve plan, invoice, balance, auto-reload, and private Web quota settings remain Web-owned | response schemas, permission fallback, generic-error boundary, full app suite |
| Repositories & Wiki | bounded repository list, index-status read, search, and documented beta status | no private indexing mutation or browser-cookie reuse | repeated/missing-cursor, 1,000-item bound, identity-deduplication, nested-status schema tests |
| Knowledge | complete bounded note list, folder tree/filter, folder-aware create/update/delete | suggestions and private Web settings remain Web-owned | strict write schemas, response schemas, endpoint path/body tests, permission fallback |
| Playbooks | list/search/create/update/delete and validated command macro | structured-output schema editor and Skills & Rules remain deferred | strict write schemas, macro normalization/validation, endpoint tests |
| Automations | recurring and one-time schedule CRUD, enabled state, notification mode, documented agent, playbook, and tags | event-driven private Web Automations and ambiguous `advanced` writes are not claimed | timing validation, strict request schemas, full-option body test, query invalidation tests |
| Attachments | bounded image/video/file selection and documented Cloud upload flow | local ACP file/image transfer remains deferred until path, size, lifecycle, and permission rules exist | picker tests, generic picker/upload errors, composer validation |
| Session creation | separate Cloud and Computer destinations, repositories versus opaque workspaces, live local model catalog and variants | service-user attribution is not human-account impersonation; unsupported ACP controls stay hidden | Cloud/local creation, model catalog, repository/workspace, handoff, and composer suites |
| Session lifecycle | message, refresh, archive, terminate, local load/continuation, and capability-gated ownership handoff | local close/resume/delete/fork are not claimed when ACP does not advertise them | endpoint, local history, ownership, refresh, archive/terminate, and dispatcher suites |
| Connections & devices | Cloud, Computer, and combined modes; Tailscale pairing; per-device read/send/create grants; revoke/remove/wipe | same-Wi-Fi removed from v1; no credentials enter React state or browser storage | pairing, pinned transport, replay, rate-limit, permission, persistence, revoke, and wipe suites |
| Security Work | documented session-based read-only security review workflow and exact tagged-session grouping | not the enterprise Code Scan dashboard; no private scan route, service-account impersonation, or Web login handoff | Security Work grouping, prompt, screen, session-boundary, and generic-error tests |

## Security and privacy gates

- Protected Connector routes remain server-authorized per device. Invalid or unauthorized
  resources return a generic `404`, and protected write routes retain their rate-limit classes.
- Cloud resource writes are parsed through strict Zod request schemas before a request is built.
  Organization paths come only from `AuthProvider`; caller-supplied resource IDs are bounded and
  reject path separators.
- Cloud responses continue to parse through Zod at the API boundary. Raw API bodies, schema paths,
  prompts, repository identifiers, and session content are no longer rendered as error copy.
- Auth material remains in Secure Store/Keychain. The tracked-file secret gate and the browser
  storage gate pass; no auth token uses `localStorage` or `sessionStorage`.
- Remote Markdown is capped below the known resource-exhaustion threshold and uses a parser with
  typographer/smartquotes disabled. Long responses show an explicit safe truncation notice.
- Voice files contain no fetch, Axios, URLSession, WebSocket, or API-client import. Speech audio is
  processed as in-memory PCM buffers and the implementation contains no file/temp-storage API.
  Transcript-bearing diagnostic keys are scrubbed.
- The microphone permission is user initiated and the archived disclosure must read exactly:
  “DevinX uses the microphone to transcribe your voice into session prompts. Audio is processed
  entirely on your device and never uploaded.”

## Dependency and build gates

Validated with Node 24 on July 13, 2026:

- all direct runtime and development dependencies are exact-pinned;
- lockfile dry-run install succeeds;
- lint passes with zero warnings;
- strict TypeScript passes for the app and Connector;
- 68 Jest suites / 503 tests pass with open-handle detection;
- Connector TypeScript and Keychain helper build successfully;
- `npm audit --audit-level=high` passes with 0 high and 0 critical findings.

The explicit moderate review reports 21 affected dependency nodes from three underlying advisory
areas:

1. `markdown-it` is transitive through `react-native-markdown-display`. The release boundary caps
   input at 48,000 characters and disables the affected typographer path. A forced incompatible
   major override is not used.
2. Expo's nested PostCSS is build tooling. The proposed audit remediation jumps to Expo 57 and is
   not safe inside this Expo 54 release candidate.
3. Expo's `xcode` tooling carries a UUID buffer advisory for caller-supplied buffers. DevinX does
   not call the affected UUID APIs at runtime; the forced remediation also requires the breaking
   Expo upgrade.

These moderate findings remain tracked for the planned Expo upgrade. They are not hidden or
misrepresented as fixed.

## Voice and Scribe evidence

- The accepted iPhone 16 Pro SpeechAnalyzer benchmark remains recorded in
  `specs/007-voice-spec-analysis.md`: 9.01% mean WER, 0.946-second median file analysis, 0.0185
  median real-time factor, and 129.7 MiB observed peak.
- Deterministic on-device “Organize prompt” remains the universal Scribe path. It preserves the
  transcript, shows a before/after preview, and requires confirmation. No cloud LLM is called.
- Automated coverage passes for microphone placement/state, one Stop action, mixed text insertion,
  cancel/stop cleanup, hint caps and secret exclusion, deterministic Scribe output, permission copy,
  no-network imports, no audio-file writes, app background handling, Reduce Motion, and transcript
  diagnostic scrubbing.
- Runtime network capture, AirPods route changes, call/Siri interruptions, permission recovery,
  VoiceOver, and repeated long recordings remain physical-device checks. They cannot be honestly
  closed by unit tests or the iOS simulator.

## Connector distribution checkpoint

- The macOS app, embedded runtime, Keychain helper, and DMG rebuild successfully.
- Strict nested code-sign verification and DMG verification pass; the adjacent SHA-256 file verifies.
- The current artifact is intentionally ad-hoc signed. Gatekeeper rejects it, as expected, because
  the available Keychain contains Apple Development and iPhone Distribution identities but no
  **Developer ID Application** identity.
- The notarization workflow fails closed when `DEVINX_CODESIGN_IDENTITY` and notary credentials are
  absent. Public signing/notarization/stapling, clean-account install/update/uninstall, and artifact
  publication remain external gates. No public Connector artifact is authorized by this audit.

## Consolidated visual pass

- The current bundle launched in the iOS 26.5 simulator in light and dark appearance. The
  unauthenticated screen preserved safe-area clearance, theme-matched canvas, readable hierarchy,
  the transparent wordmark, disclaimer, and one primary action without clipping.
- Static inspection of Home, Sessions, Cloud/Computer details, Repositories & Wiki, Knowledge,
  Playbooks, Automations, Usage, Review, Analytics, Secrets, Settings, Privacy, connection sheets,
  and voice controls found no component-level raw colors. They continue to use the shared theme,
  type, spacing, radius, status, and sheet tokens.
- The accessibility AST gate confirms every icon-only `Pressable`/`Touchable` has an explicit
  label. Shared modal editors use safe-area bottom padding, 85% height bounds, keyboard avoidance,
  explicit dismissal, and theme-aware scrims.
- Authenticated data states cannot be truthfully pixel-approved from an unauthenticated simulator.
  Build 47 provides the most recent physical visual baseline; the expanded product screens and
  destructive/editing states remain listed in the next-build physical checkpoint below.

## Physical checkpoint after the next internal upload

Use the exact next TestFlight candidate and sanitized sessions. Confirm:

1. Home plus Cloud and Computer session creation, all destination-specific pickers, attachments,
   archive/terminate, device removal/revocation, and all three connection modes after cold launch.
2. Dictation in Home, Cloud, and Computer composers: mixed typing, Stop, Cancel, Organize prompt,
   permission denial/recovery, interruption, AirPods, VoiceOver, Dynamic Type, and Reduce Motion.
3. Light/dark launch, long-history scrolling behind the transparent companion, no clipped content,
   keyboard clearance, scanner sizing, and no raw Mac path or ACP identifier.
4. Cold-launch, 200-row scrolling, one-hour foreground battery, and seven-day TestFlight stability
   using `docs/physical-performance-checklist.md`.

Only internal TestFlight upload is approved. App Review, public release, production OTA publication,
and public Connector distribution still require separate explicit approval.
