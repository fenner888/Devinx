# Internal release-candidate audit — July 13, 2026

This record covers the automated release work after iOS Build 47. It authorizes neither App
Review nor a public Connector release. The authenticated product inventory and supported parity
decisions are in `specs/033-cloud-local-settings-parity.md`; route-level authorization evidence is
in `docs/authorization-matrix.md`.

## Post-Build-56 visual-acceptance candidates

- Release source `43bd171` preserves the supported Build 56 product boundary and adds two reviewed
  changes only: truthful live session activity from `0907d2b` and the approved token-driven Home
  planetary companion stage. Cloud never invents tool events; Computer activity comes from the
  protected ACP stream. The Home backdrop is decorative, pointer-free, accessibility-hidden,
  bounded on phones/tablets, and adds no animation or dependency.
- Exact Node `24.18.0` CI passed: lint, strict TypeScript, 73 Jest suites / 522 tests, app and
  Connector builds, and the high/critical dependency gate. The existing 21 moderate transitive
  findings remain reviewed and unchanged.
- The private macOS Connector rebuilt and verified with bundled Node `24.18.0`; ad-hoc DMG SHA-256
  is `008d6976ab21222c168d0834840dc5972014f964e243f3c9a685a5b68f04d9c2`. No Developer ID
  Application identity or `devinx-notary` Keychain profile is installed, so public signing,
  notarization, stapling, and Gatekeeper acceptance remain external gates.
- iOS `0.1.0 (57)` was archived from clean source `43bd171` with Node `24.18.0` and Xcode `26.6`.
  The 20,700,649-byte IPA has SHA-256
  `2a5785cfde425e455e4a150de7b6c8a900fe24eb8f6d1aa9d4db8af1b4997188` and passed strict signing,
  metadata, entitlement, disclosure, production update/runtime, and 10-manifest privacy inspection.
- EAS submission `b61fdf5a-9a0d-47e4-8c93-2a390780b271` uploaded Build 57 to App Store Connect for
  internal TestFlight. App Store Connect completed processing and shows Build 57 as **Ready to
  Submit** in the one-tester **Team (Expo)** internal group, with one install recorded. Physical
  review rejected its generated Home stage because the opaque geometric surface read as a hard
  rectangular shelf. Build 57 is therefore superseded and is not a frozen UI.
- Release source `e21c8c9` replaces the rejected generated stage with the owner-supplied 1280×853
  space artwork. The real React Native renderer was inspected on an iPhone simulator: the horizon
  and floor light sit beneath Devin, the black field fades into the true-black canvas, and no
  shipping preview route remains. Light mode uses a quiet semantic-token halo rather than a black
  image block.
- Exact Node `24.18.0` CI passed on the corrected source: lint, strict TypeScript, 73 Jest suites /
  525 tests, app and Connector builds, and the high/critical dependency gate. The existing 21
  moderate transitive findings remain reviewed and unchanged.
- iOS `0.1.0 (58)` was archived from clean source `e21c8c9` with Node `24.18.0` and Xcode `26.6`.
  The 20,821,478-byte IPA has SHA-256
  `34aeefe1970e5f18b9e279ada9c1cb8c31f6a2b6f10bb1218646447f558eb288` and passed strict signing,
  metadata, entitlement, disclosure, production update/runtime, packaged-artwork, and 10-manifest
  privacy inspection.
- EAS submission `b53ef440-ed63-496d-b33f-9781aa3af02a` successfully uploaded Build 58 to App Store
  Connect for internal TestFlight. App Store Connect completed processing and shows Build 58 as
  **Ready to Submit** in the one-tester **Team (Expo)** internal group with one invitation and no
  installs recorded. Physical acceptance remains external; no App Review or public release action
  was taken.

## Internal candidate produced

- Post-Build-54 capability-boundary commit `c1f5edc` adds the supported read-only official Devin
  MCP integration catalog and indexed-repository Wiki, binds Wiki deep links to repositories
  returned by the authenticated Cloud connection, removes the unsupported repository-indexing
  mutation and private billing handoff, and aligns privacy/listing evidence. It is the functional
  baseline for consolidated internal Build 55. Commit `3162a33` then corrects the final model
  contract: Cloud exposes and submits only the documented `normal`/`fast` modes, while Computer
  sends the exact live ACP model (including Adaptive) and requires configuration confirmation
  before dispatching the initial prompt. Build 56 supersedes Build 55 for physical testing.
- Physical Build 50 testing exposed a keyboard-layout regression: the absolute composer was a
  sibling of the flex child resized by `KeyboardAvoidingView`, so the keyboard could cover the
  composer while the timeline scrolled into its reserved tail clearance.
- Cloud and Computer session layouts now keep the floating composer inside the keyboard-resized
  viewport. Ancestor-chain regression tests prove both composer shells remain inside that viewport.
- iOS `0.1.0 (56)` was archived from clean release-source commit `3162a33` with Node `24.18.0`
  and Xcode `26.6` selected explicitly.
- IPA SHA-256: `fdb46ebadb07715756d7136af34aca13615fdef3da5ebfbd9269f0fea5fdb8d6`.
- Strict code-sign verification passed with `get-task-allow=false`, no APS entitlement,
  `NSFileProtectionComplete`, exempt encryption set to false, the exact on-device microphone
  disclosure, production update channel, and runtime `0.1.0`.
- All 10 packaged privacy manifests declare zero collected-data types, no tracking, and no
  tracking domains. No Sentry or notification artifact is packaged.
- EAS submission `f0de572c-7599-40de-9ef9-d13ee6f0d4da` finished successfully and uploaded Build
  56 to Apple on July 13, 2026 for internal TestFlight. Apple processing remains external at this
  checkpoint. No App Review or public release was submitted.

## Product surface verification

| Surface               | Supported mobile behavior                                                                                              | Boundary                                                                                                                                                                                 | Automated evidence                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Usage & Limits        | organization consumption, ACU limits, and permission-gated metrics                                                     | self-serve plan, invoice, balance, auto-reload, and private Web quota settings remain unavailable until Devin publishes an account-scoped management API; no browser handoff is compiled | response schemas, permission fallback, native unavailable-state regression, generic-error boundary, full app suite                |
| Integrations & MCP    | read-only installed/available integration and MCP-server catalog through the official Devin MCP                        | no install, OAuth, custom-server, secret-header, or configuration mutation without a documented write tool                                                                               | MCP initialization/envelope/content Zod parsing, response cap, normalization, authenticated screen, and dead-control tests        |
| Repositories & Wiki   | bounded repository list, index-status read, search, official MCP Wiki structure/content, and repository questions      | no private indexing/generation mutation or browser-cookie reuse; a deep link must match an indexed repository returned by the authenticated Cloud list                                   | repeated/missing-cursor, 1,000-item bound, identity-deduplication, nested-status schema, MCP, and runtime deep-link binding tests |
| Knowledge             | complete bounded note list, folder tree/filter, folder-aware create/update/delete                                      | suggestions and private Web settings remain Web-owned                                                                                                                                    | strict write schemas, response schemas, endpoint path/body tests, permission fallback                                             |
| Playbooks             | list/search/create/update/delete and validated command macro                                                           | structured-output schema editor and Skills & Rules remain deferred                                                                                                                       | strict write schemas, macro normalization/validation, endpoint tests                                                              |
| Automations           | recurring and one-time schedule CRUD, enabled state, notification mode, documented agent, playbook, and tags           | event-driven private Web Automations and ambiguous `advanced` writes are not claimed                                                                                                     | timing validation, strict request schemas, full-option body test, query invalidation tests                                        |
| Attachments           | bounded image/video/file selection and documented Cloud upload flow                                                    | local ACP file/image transfer remains deferred until path, size, lifecycle, and permission rules exist                                                                                   | picker tests, generic picker/upload errors, composer validation                                                                   |
| Session creation      | separate Cloud and Computer destinations, repositories versus opaque workspaces, live local model catalog and variants | service-user attribution is not human-account impersonation; unsupported ACP controls stay hidden                                                                                        | Cloud/local creation, model catalog, repository/workspace, handoff, and composer suites                                           |
| Session lifecycle     | message, refresh, archive, terminate, local load/continuation, and capability-gated ownership handoff                  | local close/resume/delete/fork are not claimed when ACP does not advertise them                                                                                                          | endpoint, local history, ownership, refresh, archive/terminate, and dispatcher suites                                             |
| Connections & devices | Cloud, Computer, and combined modes; Tailscale pairing; per-device read/send/create grants; revoke/remove/wipe         | same-Wi-Fi removed from v1; no credentials enter React state or browser storage                                                                                                          | pairing, pinned transport, replay, rate-limit, permission, persistence, revoke, and wipe suites                                   |
| Security Work         | read-only discovery of genuine top-level `code_scan` sessions and their returned child agents                          | no ordinary-session simulation, private scan route, service-account impersonation, Web login handoff, findings dashboard, or scan-create claim                                           | exact-origin grouping, false-positive rejection, screen, session-boundary, and generic-error tests                                |

The dormant enterprise findings/metrics/remediation client was removed before Build 50.
Those routes are not compiled into v1, so ordinary Pro/Max credentials cannot accidentally probe
an enterprise boundary. Security Work remains session-only and exact-origin.

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
- 71 Jest suites / 517 tests pass with open-handle detection;
- Connector TypeScript and Keychain helper build successfully;
- `npm audit --audit-level=high` passes with 0 high and 0 critical findings.
- CI now reads the exact Node version from `.nvmrc`, matching the package engine and local release
  workflow instead of carrying a second runtime pin.
- The only dependency install scripts are exact `esbuild@0.28.1` and `fsevents@2.3.3`; both package
  names, versions, repositories, publication histories, and registry download histories were
  verified before they were allowlisted. A clean lockfile install succeeds with those two entries.

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
- Strict nested code-sign verification, read-only DMG mounting, exact Applications link, clean-copy
  installation, deliberate replacement mechanics, temporary app removal, executable bits,
  entitlement allowlist, bundled Node `v24.18.0`, source-map absence, and adjacent checksum
  verification pass. The current ad-hoc DMG SHA-256 is
  `008d6976ab21222c168d0834840dc5972014f964e243f3c9a685a5b68f04d9c2`.
- The confirmed native uninstall path stops the listener before deleting the Connector's protected
  Keychain identity and paired-device registry, unregisters launch at login, and asks macOS to move
  the application to Trash. Strict IPC, state-deletion, sanitized-failure, and native-build checks
  pass; current CI is 73 suites / 525 tests.
- The current artifact is intentionally ad-hoc signed. Gatekeeper rejects it, as expected, because
  the available Keychain contains Apple Development and iPhone Distribution identities but no
  **Developer ID Application** identity.
- The notarization workflow fails closed when `DEVINX_CODESIGN_IDENTITY` and notary credentials are
  absent. Public signing/notarization/stapling, clean-account login-start/signed-replacement/
  confirmed-uninstall testing, and artifact publication remain external gates. No public Connector
  artifact is authorized by this audit.

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
- Cloud and Computer session composers now use the existing 8% semantic tint as their floating
  fill. Their shells and companion tracks remain transparent, and timeline clearance keeps the
  final message line above both pointer-free overlays.

## Physical checkpoint for Build 58

Use exact internal TestFlight Build 58 with sanitized sessions. Confirm:

1. Home plus Cloud and Computer session creation, all destination-specific pickers, attachments,
   archive/terminate, device removal/revocation, and all three connection modes after cold launch.
2. Dictation in Home, Cloud, and Computer composers: mixed typing, Stop, Cancel, Organize prompt,
   permission denial/recovery, interruption, AirPods, VoiceOver, Dynamic Type, and Reduce Motion.
3. Light/dark launch, long-history scrolling behind the transparent companion, no clipped content,
   conversation content visibly behind the floating translucent Cloud and Computer composers,
   complete final-line clearance above both overlays, keyboard clearance, scanner sizing, and no
   raw Mac path or ACP identifier. Build 58 contains the floating-composer correction,
   keyboard-viewport fix `791a338`, supported capability-boundary work from `4825409`, final
   model-contract enforcement from `3162a33`, truthful live activity `0907d2b`, and the approved
   owner-supplied Home companion artwork correction `e21c8c9`.
4. Cold-launch, 200-row scrolling, one-hour foreground battery, and seven-day TestFlight stability
   using `docs/physical-performance-checklist.md`.

Only internal TestFlight upload is approved. App Review, public release, production OTA publication,
and public Connector distribution still require separate explicit approval.
