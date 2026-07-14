# Build 62 physical acceptance record

Candidate: DevinX `0.1.0 (62)`  
IPA SHA-256: `e5bff1a0a29fdd6c88b6cce4fb24890b84c73d79ceba5719e893d83db005d353`  
Tester:  
Date started:  
Date completed:  
iPhone model / iOS:  
iPad model / iPadOS:  
Devin account tier used:  
Connector source / hash: `4c5f139` / `8fffe9b33afcae1d152f63f0cf8fed4c99a3b3864e0619c88fa1c78e7843dd3e`

Use only a non-production account, sanitized repositories, and harmless prompts. Record **Pass**, **Fail**, or **Not available** plus a short observation. A privacy, authorization, data-loss, crash, or unsupported-capability failure blocks release.

## Installation and launch

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Fresh TestFlight install reaches the intended onboarding state |  |  |
| Upgrade from the previous TestFlight build preserves expected non-secret state |  |  |
| Light launch has no dark rectangle, incorrect splash color, or logo flash |  |  |
| Dark launch has no light rectangle, incorrect splash color, or logo flash |  |  |
| App switcher obscures protected content |  |  |
| Force-quit and relaunch preserve the selected Cloud/Computer/combined mode |  |  |

## Home and navigation

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Home planetary companion stage matches the frozen design in dark mode |  |  |
| Light-mode fallback is readable and does not expose an opaque dark image block |  |  |
| Readiness header is concise and truthful for the active connections |  |  |
| Cloud Home recents show only Cloud sessions |  |  |
| Computer Home recents show only the selected computer's sessions |  |  |
| View all shows the combined, clearly labeled archive |  |  |
| Navigation, Settings, sheets, and pickers can all be dismissed |  |  |
| No control claims an unavailable or web-only capability |  |  |

## Cloud session path

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Create a harmless Cloud session with a selected repository |  |  |
| Normal mode creates and responds successfully |  |  |
| Fast mode creates and responds successfully when the account is entitled |  |  |
| Existing session loads bounded history and refreshes after send |  |  |
| Archive/terminate behavior matches the supported API and asks for confirmation |  |  |
| Attachment picker, preview, removal, and send work with sanitized media |  |  |
| Long final response scrolls fully above the companion and composer |  |  |

## Computer and Connector path

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Tailscale pairing succeeds with a fresh one-use code |  |  |
| Name this Mac remains visible while typing on the smallest available iPhone |  |  |
| Keyboard dismisses interactively and with Done without losing the name |  |  |
| Read, send, and create permissions are independently enforced |  |  |
| Session discovery never exposes a raw path or raw ACP identifier |  |  |
| Create a harmless Computer session in an approved workspace |  |  |
| Adaptive or selected model is confirmed before the first prompt dispatch |  |  |
| A phone-created session becomes available in Devin Desktop after the turn |  |  |
| A later phone turn can continue after Desktop releases the session |  |  |
| Removing the computer on iPhone immediately removes access |  |  |
| Revoking the iPhone on Mac immediately removes access |  |  |
| Re-pair after revocation creates a distinct working authorization |  |  |

## Session composer and companion

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Cloud composer remains visible above the keyboard |  |  |
| Computer composer remains visible above the keyboard |  |  |
| Hide Keyboard and interactive dismissal preserve the draft |  |  |
| Composer is translucent without an opaque black shelf or hidden final line |  |  |
| Companion is pointer-transparent and never blocks history or controls |  |  |
| Active work shows only the approved **Devin working** caption |  |  |
| No stale timeline activity trail or passive status message remains |  |  |
| Start, walk, working, completion, blocked, and error transitions do not glide or lag visibly |  |  |

## Voice and Scribe

| Check | Result | Evidence / observation |
| --- | --- | --- |
| First mic use requests permission only after an explicit tap |  |  |
| Permission denial explains recovery and opens iOS Settings |  |  |
| One visible stop control appears beside Send |  |  |
| Streaming transcript appears at the cursor and mixes with typed text |  |  |
| Stop preserves finalized text; cancel preserves text that existed before recording |  |  |
| Organize prompt opens a before/after confirmation and never auto-applies |  |  |
| Home, Cloud session, and Computer session composers all pass |  |  |
| Phone-call/background interruption stops recording and preserves partial text |  |  |
| AirPods/Bluetooth routing works |  |  |
| No raw audio or transcript appears in logs, analytics, or crash output |  |  |

## Security Work and supported product surfaces

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Security Work is native and never opens Devin web |  |  |
| Only genuine top-level sessions with canonical origin `code_scan` appear |  |  |
| Ordinary API/tagged reviews do not appear as code scans |  |  |
| Coordinator and returned child-agent work can be inspected |  |  |
| No unsupported scan-create control is offered |  |  |
| Usage & Limits displays only supported, authenticated information |  |  |
| Wiki lists only repositories returned by the authenticated Cloud connection |  |  |
| Playbooks, Automations, Connections, integrations/MCP catalog, and Settings expose no fake mutation controls |  |  |

## Privacy, wipe, and authorization

| Check | Result | Evidence / observation |
| --- | --- | --- |
| Cloud disconnect clears its credentials and cached user data |  |  |
| Computer disconnect clears its credential, cache, drafts, and remembered context |  |  |
| Complete local-data wipe returns to a clean unauthenticated launch |  |  |
| A revoked phone receives generic non-disclosing errors |  |  |
| Replaying an old pairing request or authorization fails |  |  |
| Cross-session and cross-device identifiers cannot retrieve unauthorized data |  |  |

## Accessibility and responsive layouts

| Check | Result | Evidence / observation |
| --- | --- | --- |
| VoiceOver names every icon-only action and reports recording state |  |  |
| Dynamic Type keeps critical actions reachable without clipped text |  |  |
| Reduce Motion replaces unnecessary movement while preserving state |  |  |
| Light and dark themes remain readable across Home, sessions, Settings, and sheets |  |  |
| Pairing scanner is immediately visible, bounded, and dismissible in both themes |  |  |
| iPad portrait and landscape layouts avoid phone-width stretching and clipped sheets |  |  |

## Performance and stability

| Measure | Target | Result / evidence |
| --- | --- | --- |
| Five cold launches per configured mode | Median under 2 seconds to usable cached state |  |
| Sanitized 200-row session-list scroll | Sustained 60 fps on a 60 Hz device with no visible stalls |  |
| One-hour Balanced foreground run | Under 2 percentage points attributable battery use |  |
| Seven-day exact-build TestFlight window | Greater than 99.5% crash-free sessions and no release-blocking report |  |

## Final disposition

- [ ] All available checks passed.
- [ ] Every **Not available** item is documented and does not create an unsupported product claim.
- [ ] No release-blocking privacy, authorization, data-loss, crash, or accessibility defect remains.
- [ ] The tester accepts Build 62 as the screenshot candidate.

Tester sign-off:  
Owner acceptance:  
Release-blocking defects, if any:  
