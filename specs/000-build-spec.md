# DevinX — Mobile Mission Control for Devin
### Full Build Specification & Devin Handoff Package

**Author:** Mark Fenner (@_markfenner)
**Date:** July 7, 2026
**Version:** 1.0
**Name:** DevinX (decided — see §1.4 for trademark posture and required mitigations)
**Status:** Ready for Devin handoff

---

## 0. How to Use This Document

This is the single source of truth for the build. It follows the security-first build process (Intake → Architecture → Build → Ship → Iterate) with security gates at every phase transition.

**If you are Devin reading this:** Start with §12 (Phase 0 session). Do not skip the design token extraction task. Follow the phased session plan in §12 exactly — one session per phase, each ending in a PR. Read §8 (API client design) before writing any networking code. All security requirements in §10 are non-negotiable gates, not suggestions.

**Repo convention:** This file lives at `/specs/000-build-spec.md`. Each phase gets its own spec file (`/specs/001-phase-0-foundation.md`, etc.) generated from §12. Agent-agnostic; portable across Devin, Cursor, Windsurf/Devin Desktop, and Codex.

---

## 1. One-Page Spec (Intake)

**PROJECT NAME:** DevinX — Mobile Mission Control for Devin

**PROBLEM STATEMENT:**
Devin is an async cloud engineer — you queue work and review output. That workflow is inherently mobile-shaped, but Devin has no native mobile surface. Today, checking a session from your phone means a desktop web UI in Safari, or waiting for a Slack ping. Engineers running multiple parallel Devin sessions have no way to monitor, steer, or kick off work away from their desk. Blocked sessions waiting on human input burn wall-clock time silently.

**TARGET USER:**
Devin Teams/Enterprise users (engineers, EMs, solo builders) who run multiple async sessions and live partially on their phone. Technical, comfortable pasting an API key, already paying for Devin. Secondary audience: Cognition itself (this is also a pitch artifact demonstrating what their API enables).

**CORE FLOWS (verb-noun):**
1. Connect Account — paste API key + org ID, validate, store in Keychain
2. Monitor Sessions — live board of all sessions with status, filters, pull-to-refresh
3. Start Session — composer with prompt, playbook, tags, ACU limit, attachments
4. Steer Session — read message timeline, send follow-up messages (auto-resumes suspended sessions)
5. Review Output — PR links, structured output viewer, session insights
6. Manage Session — archive (sleep), terminate, tag, pin
7. Track Spend — ACU consumption view for the billing cycle

**DATA OBJECTS:**
- `Credentials` (API key, org ID) — device only, Keychain
- `Session` (id, title, status, tags, PR URLs, timestamps) — fetched, cached in memory/SQLite cache
- `Message` (session-scoped, cursor-paginated) — fetched, cached
- `Playbook`, `KnowledgeNote`, `Secret` (reference lists for composer) — fetched
- `AppPreferences` (polling interval, theme, default tags) — device only
- Phase 2 only: `DeviceToken` + `WatchRegistration` — notifier service

**REQUIRED INTEGRATIONS:**
- Devin API v3 (primary; v1 fallback where v3 lacks parity)
- Auth: none in v1 (the Devin API key IS the auth) — architected for PAT swap
- Payments: none (free app / pitch artifact)
- Email: none
- Storage: iOS Keychain via expo-secure-store; SQLite for read cache
- Errors: local-only safe diagnostic boundary; no crash-reporting SDK in v1
- Analytics: none in v1; any future opt-in analytics requires a separate privacy/security review
- Phase 2: APNs via Expo Push + thin Vercel notifier

**DATA CLASSIFICATION:**
- **Public:** none
- **Internal:** session titles, statuses, tags, message content (belongs to user's org; lives on device only, in memory + encrypted cache)
- **Sensitive:** Devin API key / future PAT (Keychain only, never logged, never leaves device in v1), org ID, session secrets composer fields (never persisted)
- **Sensitive (voice):** raw microphone audio exists only in memory or a protected temporary directory while transcription is active. It is deleted after finalization, never cached or backed up, and never leaves the device. Transcripts become ordinary prompt content and inherit every prompt-content rule in this specification. Vocabulary hints contain only non-secret cached names and a static developer vocabulary.
- **Public artifacts:** optional on-device speech model files. They contain no user data and are excluded from iCloud backup.
- **Regulated:** none directly; note that session content MAY contain user's proprietary code → treat all fetched content as sensitive-by-default

**SECURITY FLAGS:**
- PII: minimal (org member names in session attribution) → display only, never persist beyond cache, cache encrypted
- Payments: no → n/a
- Health data: no → n/a
- Minors: no → 4+ App Store rating fine, no COPPA scope
- File uploads: yes (session attachments) → size limit client-side, upload direct to Devin attachments endpoint, no intermediary

**SUCCESS METRICS:**
- 30 days: TestFlight build in Cognition contact's hands before CLTivate Devin meetup; 10 external TestFlight users
- 90 days: App Store listing live OR Cognition conversation converted (either outcome is a win); 100 users; zero security incidents

**TECH STACK:** (full rationale in §4)
- Framework: React Native + Expo (SDK latest stable) + TypeScript strict
- State/data: TanStack Query (polling, cache, retry) + Zustand (UI state)
- Storage: expo-secure-store (secrets) + expo-sqlite (read cache)
- Hosting: none for v1; Vercel for Phase 2 notifier
- CI/CD: GitHub + GitHub Actions + EAS Build/Submit
- Errors: local-only diagnostics; Analytics: none in v1

**CONSTRAINTS / DEADLINES:**
- MVP TestFlight before CLTivate Devin meetup
- iOS first; Android is a fast-follow (Expo makes this nearly free)
- Solo builder + Devin sessions; budget ≈ $0 infra for v1

### 1.4 Naming & Trademark Posture
**Decided name: DevinX.** Repo created as `devinx`. Owner's call, made with eyes open on the tradeoff below.

"Devin" and "Cognition" are Cognition AI trademarks, and DevinX embeds the mark in the product name — a departure from the Hermex precedent (a client FOR Hermes, not named Hermes). This carries real risk: it can read as an official Cognition product, which creates trademark exposure if the relationship stays independent. Mitigations, all REQUIRED:

- Disclaimer is now load-bearing, not boilerplate. In-app (Settings → About), on the App Store listing, AND on the onboarding Welcome screen: *"DevinX is an independent, unofficial client for the Devin API. Not affiliated with, endorsed by, or a product of Cognition AI."*
- App Store subtitle uses the unofficial-client framing explicitly: "Unofficial mission control for Devin sessions."
- Do not use Cognition's logo, Devin's logomark, or their mascot anywhere. Extracted design tokens (colors/type) are aesthetic alignment; logos are trademark use. Hard line.
- **Raise the name directly in the Cognition pitch conversation, early.** Best case: they bless it or suggest an alternative — either way the exposure resolves. If they push back, renaming is a one-file token/string change plus repo rename; the architecture never references the name.
- App Store review note: Apple sometimes rejects apps with third-party trademarks in the name absent authorization. Have the fallback name ready BEFORE submission. Fallbacks: **Cockpit**, **Dispatch**, **Overwatch**.
- Keep all name strings in a single constants file (`/src/lib/branding.ts`) so a rename is a one-line change. Deep link scheme `devinx://` also lives there.

---

## 2. Product Research Summary (Why This Architecture)

### 2.1 The Hermex Pattern (our guide)
Hermex = native iOS thin client → self-hosted bridge server (hermes-webui) → local agent. The bridge exists because Hermes Agent is a local process with no hosted API. Hermex's excellence we replicate:

| Hermex did | DevinX does |
|---|---|
| Server URL in iOS Keychain, password never stored | API key + org ID in Keychain, never in UserDefaults/AsyncStorage, never logged |
| `/health` connectivity test in setup flow | Validate key with a cheap authenticated call before completing onboarding |
| Native-feeling, fast, focused client | Native-quality RN with platform conventions (haptics, context menus, pull-to-refresh) |
| SSE streaming with auto-reconnect | Adaptive polling with cursor pagination (Devin has no SSE — see §2.3) |
| Session pinning, archiving, grouping | Same, mapped to Devin tags + archive endpoint + local pins |
| "Your server, your data" trust story | "Your key, your device — direct to Cognition's API, nothing in between" |
| Approval cards for dangerous commands | Devin equivalent: secret-request and blocked-session surfacing (§7.4) |

**The key inversion:** Devin Cloud already IS the hosted server. The entire middle layer Hermex needs (bootstrap script, Cloudflare Tunnel, Tailscale) does not exist here. Onboarding drops from ~15 minutes of infrastructure to "paste a key." This is DevinX's structural advantage and the reason a v1 needs zero backend.

### 2.2 Devin's Three Surfaces
- **Devin Cloud** — hosted REST API at `api.devin.ai`. Full session lifecycle. **This is the v1 target.**
- **Devin CLI** — local agent with a supported ACP JSON-RPC server over stdio (`devin acp`), machine-readable session listing, ATIF export, lifecycle hooks, and `/handoff`. Phase 3 adds a user-controlled Desktop Bridge that adapts this supported CLI surface to an authenticated mobile connection; it never scrapes CLI storage or private process state.
- **Devin Desktop** (formerly Windsurf) — may install the `devin` CLI, but direct Desktop session access remains out of scope until Cognition publishes a supported interface. DevinX connects to the CLI surface, not private Desktop data, databases, or IPC.

**Public-release scope decision (July 10, 2026):** public distribution waits until users can choose Cloud only, Computer only, or both. Development and internal TestFlight builds still ship in phases so each trust boundary is reviewed independently.

### 2.3 API Facts That Drive Design
- **Base:** `https://api.devin.ai/v3/organizations/{org_id}/...` for sessions, knowledge, playbooks, secrets. v1 (`/v1/sessions`) remains available; use v3 as primary.
- **Auth today:** service-user keys (prefix `cog_`), Bearer token. Sessions can be attributed to a human user via `create_as_user_id` (requires impersonation permission). **Personal Access Tokens (PATs) are in closed beta** — they authenticate directly as the user with automatic attribution. Architect auth as a swappable strategy: v1 ships service-user mode; PAT mode is a config flag away (§8.2).
- **No streaming, no webhooks** in the public API → **polling architecture**. Message list endpoint is cursor-paginated and chronological → incremental polling is cheap (only fetch past the last cursor).
- **Session lifecycle:** create (with `prompt`, optional `playbook_id`, `snapshot_id`, `knowledge_ids`, `secret_ids`, `session_secrets`, `tags`, `title`, `max_acu_limit`, `structured_output_schema`, `unlisted`) → runs async → may suspend/sleep → **sending a message auto-resumes** → archive (sleep) or terminate. Session detail includes status, PR info, structured output; v3 responses include `origin`, `category`/`subcategory` fields.
- **Also available:** attachments upload/download, tags CRUD, on-demand session insights, scheduled sessions, consumption endpoints (org + daily), playbooks/knowledge/secrets list.
- **Rate limits exist** (429s documented) → client must implement backoff + jittered adaptive polling (§8.4).

**Devin: during Phase 0, fetch `https://docs.devin.ai/llms.txt` and crawl the v3 API reference. Generate `/src/api/devin/types.ts` from the actual current schemas — do not trust this document's field lists over live docs. This spec was written July 2026; the API ships changes monthly.**

---

## 3. Architecture Decision Records

**ADR-001: Direct-to-API, zero backend for v1.** The phone talks straight to `api.devin.ai` over TLS. No proxy, no server, no data path through any third party. Consequence: the API key lives on-device (mitigated: Keychain, §10) and push notifications are impossible in v1 (accepted: Phase 2 notifier). Rejected alternative: proxy backend from day 1 — adds infra, a data-custody liability, and kills the "nothing between you and Cognition" trust story.

**ADR-002: React Native + Expo over SwiftUI — DECIDED, fidelity-driven.** The primary product goal is that DevinX feels like a native extension of the existing Devin product, not a third-party reinterpretation. Devin's web app is React; RN + NativeWind shares its component DNA, styling model, and design language, making pixel-and-behavior parity achievable rather than approximate. SwiftUI would pull the app toward Apple-native conventions (system list styles, SF Symbols, iOS chrome) — the Hermex feel, not the Devin feel. Secondary benefits: (a) TypeScript strict is the stack Devin builds fastest in across Mark's repos; (b) Android is a config change; (c) EAS handles signing/build/submit. Rejected: SwiftUI (wrong aesthetic gravity, no Android), Flutter (outside stack). See §5.4 Devin Parity Standard.

**ADR-003: Polling with adaptive cadence, not sockets.** The API offers neither SSE nor webhooks. TanStack Query `refetchInterval` driven by app state: foreground + watching a running session = 5s on that session's messages; foreground board = 15s on session list; background = OS-scheduled background fetch (~15min, best-effort); terminal-status sessions = never. All polling stops on 401 and backs off exponentially on 429/5xx.

**ADR-004: Auth as a strategy interface.** `AuthProvider` interface with two implementations: `ServiceUserAuth` (key + org ID + optional `create_as_user_id`) and `PatAuth` (token only, auto-attribution). v1 ships the first; the second is wired but flag-gated until PAT GA. Onboarding copy already explains both.

**ADR-005: SQLite read-cache, memory-first.** Session list + message history cached in expo-sqlite so the app opens instantly offline with last-known state and a staleness banner. Cache is encrypted at rest via SQLCipher if available in the Expo module, else OS file protection (`NSFileProtectionComplete`). Cache is purge-on-logout and holds no secrets ever.

**ADR-006: No Supabase in v1.** There is nothing to store server-side: all durable state lives in Devin's API; all local state is device-only. Supabase would add an account system, a data custodian role, and attack surface for zero user value. **Phase 2 exception:** the push notifier needs to store `(device_push_token, org_id_hash, watched_session_ids)` — that's a Vercel KV / tiny Postgres (Neon or Supabase, either fine) behind a Vercel serverless function. Even then: the notifier uses a SEPARATE least-privilege, read-only service key the user creates for it — never the key from the app.

**ADR-007: GitHub is the workshop.** Repo on GitHub because that's where Devin works: branch protection on `main`, PRs required, Actions CI (lint → typecheck → test → build → `npm audit`), Dependabot, secret scanning, CODEOWNERS on `/src/api` and `/src/auth`. Every Devin session ends in a PR reviewed via Devin Review.

**ADR-008: Vercel only when a server exists.** v1: Vercel hosts nothing but (optionally) a marketing/waitlist page for the app (reuse markfenner.io patterns). Phase 2: Vercel serverless (or Cloudflare Worker — either acceptable; pick Vercel for stack consistency) runs the notifier cron.

---

## 4. Tech Stack (Final)

| Layer | Choice | Rationale |
|---|---|---|
| App framework | React Native + Expo, TypeScript strict | Agent velocity, Android fast-follow, EAS pipeline |
| Navigation | Expo Router | File-based, deep-link ready (`devinx://session/{id}`) |
| Server state | TanStack Query | Polling, cache invalidation, retry/backoff built-in |
| Client state | Zustand | Minimal, no boilerplate |
| Secure storage | expo-secure-store | iOS Keychain / Android Keystore |
| Cache | expo-sqlite | Offline-first read cache |
| Styling | NativeWind (Tailwind for RN) + tokens file | Matches Mark's Tailwind muscle memory; tokens in §5 |
| Animation/haptics | Reanimated 3 + expo-haptics | Native feel — the Hermex bar |
| Validation | zod | Every API response parsed at the boundary (§8.3) |
| Errors | Local-only diagnostic boundary + tested scrubber (§10) | Avoids crash-data custody and package-level privacy ambiguity in v1 |
| Analytics | None in v1 | Any future opt-in provider requires a new spec, consent flow, and privacy review |
| CI/CD | GitHub Actions + EAS Build + EAS Submit | PR checks + TestFlight automation |
| Backend (v1) | **None** | ADR-001 |
| Backend (Phase 2) | Vercel serverless + Vercel KV + Expo Push/APNs | Notifier only |
| Waitlist site | Next.js on Vercel (optional, separate repo) | Standard stack |

---

## 5. Design System — "Devin-Inspired, Not Devin-Cloned"

### 5.0 Ground Truth Extraction (Devin task, Phase 0 — REQUIRED)
The existing Devin product IS the design spec. This document's palette and component notes are fallbacks only. Steps:
1. Open `https://app.devin.ai` (Mark's account: session list, an active session, a completed session with a PR, the new-session composer, settings) and `https://cognition.com` in the browser.
2. Extract computed CSS custom properties / styles: background surface layers, text color hierarchy, the brand blue (default + hover + pressed), status colors and their EXACT label vocabulary (capture what Devin actually calls each state — working/blocked/finished/sleeping wording), border colors and weights, corner radii, spacing rhythm, font families and the type scale actually in use.
3. Screenshot every screen above at full quality. Commit to `/specs/reference-ui/` — these screenshots are the canonical visual reference for ALL subsequent build sessions. Every phase spec links back to them.
4. Document component anatomy in `/specs/design-tokens.md`: how Devin renders a session row, a status indicator, a chat message (Devin vs user), a code block, tag chips, buttons (primary/secondary/destructive), inputs, and empty states. Note interaction details visible in the UI: hover/press states, transitions, loading skeletons vs spinners.
5. Encode tokens in `/src/theme/tokens.ts`. Flag every fallback value below that you replaced.
6. Adopt Devin's status vocabulary and iconography style verbatim in DevinX — users should never have to translate between the web app's language and the mobile app's language.

### 5.1 Fallback Token Palette (dark-first)
Devin's product UI is a dark, calm, engineering-tool aesthetic: near-black blue-tinted surfaces, a confident electric blue accent, generous whitespace, quiet borders. Cognition's marketing brand is a warm off-white/cream with near-black text — we use that as the LIGHT theme's soul so the app feels like both sides of the brand.

```ts
// /src/theme/tokens.ts — FALLBACK VALUES, replace via §5.0 extraction
export const dark = {
  surface0:  '#0B0E14',  // app background (blue-tinted near-black, never #000)
  surface1:  '#11151F',  // cards, list rows
  surface2:  '#1A2029',  // elevated: sheets, menus, inputs
  border:    '#232B38',  // hairline borders, 1px
  textHi:    '#F2F5F9',  // primary text
  textMid:   '#9AA6B5',  // secondary text, timestamps
  textLow:   '#5C6875',  // disabled, placeholders
  brand:     '#3B82F6',  // Devin electric blue — CTAs, active states, links
  brandHover:'#5C9AFF',
  running:   '#3B82F6',  // status: working (brand blue, pulsing dot)
  blocked:   '#F59E0B',  // status: needs your input (amber — the money color)
  finished:  '#22C55E',  // status: done / PR ready
  sleeping:  '#8B93A1',  // status: suspended/archived (gray)
  failed:    '#EF4444',  // status: error/terminated
};
export const light = {
  surface0:  '#FAF7F2',  // Cognition cream
  surface1:  '#FFFFFF',
  surface2:  '#F1EDE6',
  border:    '#E4DFD5',
  textHi:    '#16181D',
  textMid:   '#5A5F6A',
  textLow:   '#9AA0AB',
  brand:     '#2563EB',  // darker blue for AA contrast on cream
  brandHover:'#1D4ED8',
  running:   '#2563EB',
  blocked:   '#B45309',
  finished:  '#15803D',
  sleeping:  '#6B7280',
  failed:    '#DC2626',
};
```

Rules:
- Dark is the DEFAULT theme (engineering tool; matches Devin's app). Light theme follows system preference; manual override in Settings.
- Every color pairing must pass WCAG AA (4.5:1 body text, 3:1 large text/UI). Devin: run a contrast check on the final extracted tokens and adjust the semantic layer, not the components.
- Status color + icon + label ALWAYS travel together — never color alone (accessibility).
- Semantic tokens only in components. No raw hex outside `tokens.ts`. This is what makes the §5.0 extraction a one-file swap.

### 5.2 Typography
- UI: Inter (or the exact family extracted in §5.0 if Devin's app uses something else) — 15/17/20/24/28 scale, -0.2px tracking on headings.
- Code/monospace (session IDs, commands, structured output, ACU figures): JetBrains Mono.
- Numbers in status/consumption views: tabular figures.

### 5.3 Component Language
- Radius: 12px cards, 10px inputs, 8px chips, full-round status dots.
- Borders over shadows in dark mode (1px `border`); soft shadows only in light mode.
- Status chip: dot + label (`● Working`, `● Needs input`, `● PR ready`, `● Sleeping`, `● Failed`). Running dot pulses (Reanimated, 1.6s ease, respects Reduce Motion).
- Blocked sessions get an amber left-edge accent bar on their list row — the single most important visual in the app (§7.4).
- Haptics: light impact on refresh completion, success notification haptic when a watched session flips to finished, warning haptic on blocked.
- Empty states: illustrated with a terminal-prompt motif, one-line copy, one CTA. Never blank screens. Every screen defines loading / empty / error / unauthorized states before it's considered done (build-process Pillar 2).

### 5.4 Devin Parity Standard (the fidelity bar)
DevinX should feel like Cognition shipped it. The test for every screen: **put the §5.0 reference screenshot next to the DevinX screen — a Devin user should recognize it instantly and find nothing that contradicts the web app.**

Rules of parity:
1. **Same vocabulary.** Status labels, action names (Archive vs Sleep, Terminate wording), and section names match the web app exactly. No invented terminology.
2. **Same visual hierarchy.** Session rows, message rendering, code blocks, PR badges, and tag chips follow Devin's anatomy from `/specs/design-tokens.md` — adapted for touch targets (44pt minimum), not redesigned.
3. **Same tone.** Devin's UI is calm, dense-but-breathing, engineering-grade. No gradients, no glassmorphism, no playful illustration beyond what the web app itself uses. When in doubt, quieter.
4. **Mobile-native mechanics, Devin skin.** Where the web app has no mobile equivalent (context menus, pull-to-refresh, haptics, sheets), use platform-standard mechanics styled with Devin tokens. Mechanics are iOS; appearance is Devin.
5. **Divergence log.** Any place DevinX intentionally deviates from the web app gets one line in `/specs/parity-deltas.md` with the reason (e.g., "blocked-first sorting on Board — mobile triage is the product thesis"). If it's not logged, it's a bug.
6. **Per-phase parity gate.** Each build session's PR includes side-by-side screenshots (reference vs built) for every new screen. Mark reviews parity before merge — this is a review checklist item, same weight as CI.

---

## 6. Repository Structure

```
devinx/
  specs/                      → this doc (000) + per-phase specs + design-tokens.md
  src/
    app/                      → Expo Router routes (screens)
      (onboarding)/
      (main)/
        index.tsx             → Session Board
        session/[id].tsx      → Session Detail
        compose.tsx           → New Session
        usage.tsx             → Consumption
        settings/
    components/               → pure UI, props only, zero API imports
    api/devin/                → client, endpoints, zod schemas, generated types
    auth/                     → AuthProvider strategies, Keychain access (ONLY place secrets are touched)
    theme/                    → tokens.ts, ThemeProvider
    store/                    → Zustand slices (UI prefs, pins, watch list)
    lib/                      → utils, constants, polling policy
    cache/                    → sqlite cache layer
  tests/                      → mirrors src/
  .github/workflows/ci.yml    → lint → typecheck → test → build → npm audit
  .env.example                → EXPO_PUBLIC_* only; NEVER a real key (keys are runtime user input)
  SKILL.md                    → shared-context doc for agents (Mark's convention)
```

---

## 7. Screens & Flows

### 7.1 Onboarding / Connect (3 steps)
1. **Welcome** — value prop, disclaimer footer (§1.4), "Connect your Devin account."
2. **Credentials** — segmented control: `Service user key` | `Personal token (beta)`. Service path: API key field (secure entry, paste-first UX), org ID field, optional "attribute sessions to me" user picker (uses `create_as_user_id`; fetch member list if permission allows, else free-text user ID). Inline help links to Devin docs for creating a least-privilege service user (`UseDevinSessions` + read permissions only — the app should TELL users to scope down; that's the GRC DNA).
3. **Validate** — live check: authenticated `GET` self/sessions call. Success → store in Keychain → land on Board with a one-time coach-mark tour. Failure → specific error (401 invalid key / 403 missing permission, with which permission to add / network).

### 7.2 Session Board (home)
- Sections: **Needs input** (blocked, always top, amber), **Working**, **Recent** (finished/failed, grouped Today / Yesterday / Earlier), **Sleeping/Archived** (collapsed).
- Row: status chip, title, relative time, tag chips, PR badge if a PR exists, ACU count if available.
- Filters: status segmented control + tag filter sheet. Search by title.
- Long-press context menu: Pin, Archive, Terminate (destructive confirm), Copy session link, Add tag.
- Pull-to-refresh; auto-poll per ADR-003; staleness banner when showing cache offline.
- FAB / prominent "New session" button.

### 7.3 Session Detail
- Header: title (editable if API allows), status chip, ACU spend, created/updated times, origin badge (API/Slack/web).
- **Timeline tab:** chronological messages (cursor-paginated, infinite scroll upward), Devin vs user styling, markdown rendering, code blocks with copy, attachment tiles (download via attachments endpoint). Composer at bottom: sending a message auto-resumes a suspended session — surface that: "Session is sleeping — sending will wake it."
- **Output tab:** PR list (deep-link to GitHub app/web + Devin Review link if present), structured output viewer (pretty JSON + copy + share), session insights (trigger on-demand generation, render results).
- Actions menu: Archive, Terminate, Generate insights, Manage tags, Share (public session URL only if session is not unlisted — warn before sharing).

### 7.4 The Killer Interaction: Blocked-Session Triage
When Devin needs input (question, secret request, decision), that session is pure wasted wall-clock until a human responds. DevinX's entire reason to exist on a phone:
- Blocked sessions float to the very top with amber treatment + warning haptic on transition.
- Row subtitle shows the LAST Devin message preview ("Devin asked: should I migrate the enum or add a new column?").
- One tap → detail → reply composer already focused. Target: notice-to-unblock in under 20 seconds.
- Phase 2 push makes this proactive; v1 makes it effortless-on-open.

### 7.5 New Session Composer
- Prompt (multiline, paste-friendly; large paste → offer to attach as file, matching Devin web behavior).
- Collapsible "Advanced": playbook picker (fetched list), tags, title, snapshot ID, knowledge selector, secret selector, session-specific secrets (masked entry, never cached, cleared on submit), max ACU limit stepper, unlisted toggle.
- Attachment picker → upload to attachments endpoint → include reference.
- Submit → optimistic row on Board with "Starting…" state → poll.
- "Templates" (local): save composer presets on-device (this is a lightweight local playbook feel without API writes).

### 7.6 Usage / Consumption
- Current cycle ACU spend, daily bar chart (consumption endpoints), per-session cost sort. Tabular figures, JetBrains Mono. If the key lacks consumption permission, show a graceful locked state explaining which permission enables it.

### 7.7 Settings
- Account: connected org, key fingerprint (last 4 only), re-validate, **Disconnect** (wipes Keychain + SQLite cache + query cache — verified wipe, §10).
- Behavior: polling aggressiveness (Battery saver / Balanced / Fast), default tags, haptics toggle.
- Appearance: theme (System/Dark/Light).
- Privacy: analytics opt-in toggle (default OFF), "What data leaves your device?" explainer screen (answer in v1: "Only requests to api.devin.ai. Optionally, anonymous usage events to PostHog if you opt in. That's the whole list.").
- About: version, disclaimer, licenses, link to Devin docs & status.

### 7.8 Voice Spec (Dictation + Scribe)

**Status:** Session 4a approved July 12, 2026; Session 4b authorized. The selected v1 engine is an app-owned Expo module around Apple SpeechAnalyzer/SpeechTranscriber. Whisper is deferred to a later compatibility/accuracy build. V1 bundles no Whisper model; unsupported devices retain ordinary typing with a clear voice-unavailable state. Scribe uses the deterministic template on every device and Apple Foundation Models only as an availability-checked progressive enhancement. All §7.8.4 security gates remain mandatory before merge or release.

Voice Spec removes the mobile prompt-authoring bottleneck without changing Devin into a voice assistant:

1. **Dictation:** explicit-tap, on-device speech-to-text in both New Session and Session Detail composers. Interim text streams dimmed at the cursor and becomes normal editable text when finalized; typing and dictation mix freely and dictation never replaces the entire field.
2. **Scribe:** an optional, user-confirmed “Structure into work order” pass for dictations of at least 15 words. It produces editable plain text with **Goal**, **Scope / repo**, **Acceptance criteria**, and **Constraints / non-goals**. It never auto-applies.

#### 7.8.1 Session 4a analysis gate

Evaluate `whisper.rn`, a Swift-native WhisperKit Expo module, and an app-owned Expo module using Apple SpeechAnalyzer/SpeechTranscriber. Use five 30–90 second fixtures with realistic technical vocabulary (including TypeScript, Zod, Expo Router, TanStack Query, RLS, OAuth, PR, monorepo, auth middleware, kebab-case, and `api.devin.ai`). Record technical-term word error rate, end-to-end latency, real-time factor, peak memory, supported hardware/OS, maintenance health, Expo/EAS compatibility, and interruption behavior. Measure vocabulary biasing using repo, playbook, and tag names plus a capped static developer vocabulary; secret names and values are forbidden. Documentary evaluation is sufficient for candidates explicitly deferred by the decision authority; a later Whisper build must run the same physical protocol before it can replace or supplement SpeechAnalyzer.

Decide whether models are bundled or downloaded on first use. Evaluate binary/cellular impact, progress/retry UX, Settings → Storage deletion, iCloud-backup exclusion, and whether a tiny instant fallback plus an optional higher-accuracy model is justified. The approved v1 uses only Apple’s system-managed language asset and therefore ships no app-managed speech model.

Evaluate scribe in this order: Apple Foundation Models on supported iOS 26 devices; a deterministic template and filler/punctuation cleanup that ships for every device; cloud LLM scribe as a documented Phase 2 option only. Cloud STT and cloud scribe are out of v1.

#### 7.8.2 Build architecture (after 4a approval only)

```text
components/VoiceInput/   -> mic button, waveform strip, scribe chip (pure UI)
lib/voice/
  engine.ts              -> TranscriptionEngine interface + approved implementation
  hints.ts               -> capped, secret-safe vocabulary hint assembly
  scribe.ts              -> ScribeEngine interface: foundationModel | template
  models.ts              -> optional model download/manage
```

No component imports an engine implementation directly. Native modules require an EAS development/TestFlight build and are not supported in Expo Go. The first-use permission copy is: “DevinX uses the microphone to transcribe your voice into session prompts. Audio is processed entirely on your device and never uploaded.” Permission is never requested during onboarding.

#### 7.8.3 Recording UX

- A mic target sits in every composer accessory row. During recording, the row expands into a `brand` waveform on `surface2`, a JetBrains Mono `textMid` timer, and cancel/stop targets of at least 44pt. The visible recording indicator remains on screen whenever the microphone is live.
- Respect Reduce Motion with static level bars. Warn with haptics after five minutes.
- On backgrounding, interruption, or phone call: stop recording and preserve partial transcript. Support Bluetooth/AirPods routing and design explicit no-speech, permission-denied, model-missing, download/retry, and interruption states.
- Permission denial includes a deep link to iOS Settings. After finalization, insert at the current cursor and preserve all existing typed text.

#### 7.8.4 Voice security and privacy gates

1. Audio is on-device only. Add a CI test proving `lib/voice/` has no network imports and no request may contain audio bytes.
2. Any temporary audio uses a dedicated directory with `NSFileProtectionComplete`; deletion after finalization is verified by a test asserting the directory is empty.
3. Recording starts only from an explicit tap. No wake word, background listening, or onboarding permission request. Backgrounding stops recording and preserves text.
4. Transcript-bearing state is excluded from logs, analytics, and diagnostics. Extend the diagnostic scrubber test before any future reporting provider is enabled.
5. Settings → Privacy states: “Voice is transcribed on your device. Audio never leaves your phone.” App Store privacy remains “Data Not Collected.”
6. Optional model artifacts are public, excluded from backup, removable, and never mixed with user content.
7. Any future cloud scribe is a separately reviewed, opt-in, per-use Phase 2 feature with a distinct consent screen and updated privacy disclosures.

#### 7.8.5 Explicit voice non-goals (v1)

No voice conversation, wake word, cloud STT, cloud scribe, response TTS, Android voice work before the Android build exists, or Willow dependency. Third-party dictation keyboards continue to work as standard text input.

---

## 8. API Client Module Design

### 8.1 Layering
```
components → hooks (useSessions, useMessages, useCreateSession …)
           → queries (TanStack Query defs: keys, polling policy, invalidation)
           → endpoints (typed functions per API route)
           → client (fetch wrapper: auth header injection, base URL, retry/backoff, error taxonomy)
           → auth (AuthProvider strategy; the ONLY module importing secure-store)
```
Components never import from `endpoints` or `client`. `auth` is never imported by anything except `client` and the Settings/Onboarding screens.

### 8.2 Auth Strategy
```ts
interface AuthProvider {
  kind: 'service_user' | 'pat';
  authHeaders(): Promise<Record<string, string>>;   // { Authorization: `Bearer …` }
  orgPath(): Promise<string>;                        // '/v3/organizations/{orgId}'
  sessionAttribution(): Promise<{ create_as_user_id?: string }>;
  validate(): Promise<ValidationResult>;             // cheap authed call; maps 401/403 to actionable errors
}
```
`PatAuth` behind `EXPO_PUBLIC_ENABLE_PAT` until GA. Key retrieval is lazy + memoized per app foreground; never held in module-level state longer than needed; zeroized on disconnect.

### 8.3 Boundary Validation
Every response parses through zod schemas in `/src/api/devin/schemas.ts`. Unknown fields pass through (API evolves monthly); missing REQUIRED fields fail closed with a typed `ApiSchemaError` passed to a local no-op diagnostic boundary without logging content. Devin: generate schemas from live docs (§2.3 note), then hand-tighten.

### 8.4 Polling Policy & Resilience
- `pollingPolicy(sessionStatus, appState, screen)` → interval or `false`. Defaults: watched-session messages 5s, board 15s, background OS-scheduled, terminal statuses never.
- 429 → exponential backoff with jitter, honor `Retry-After` if present, global cooldown flag so all queries pause together.
- 401 → hard stop all polling, route to re-auth screen (key may be revoked/rotated).
- 5xx/network → TanStack retry (3, exponential), then stale-cache mode with banner.
- All requests: 15s timeout, `Idempotency` on create where supported (`idempotent: true` param exists on session create — use it to make retry-safe creates).

### 8.5 Endpoint Coverage (v1 app)
Sessions: create, list (with status/tag filters, pagination), detail, messages list (cursor), message send, archive, terminate, tags add/remove, insights generate/get.
Reference data: playbooks list, knowledge list, secrets list (names/IDs only — never values), org members (for attribution picker, permission-gated).
Attachments: upload, download.
Consumption: org daily; read-only enterprise billing cycle and ACU-limit endpoints when the credential has `ManageBilling`, with graceful permission-gated fallback. Self-serve quota and credit-balance values remain web-only until Devin publishes an API.
Explicitly NOT called in v1: any write to enterprise billing/limit endpoints, audit logs, or undocumented endpoint; playbook/knowledge/secret writes are separately permission-gated features and never required for the core session flow.

---

## 9. Data Model (Local)

SQLite cache (read-only mirror, purge-on-logout):
```sql
sessions  (id TEXT PK, payload JSON, status TEXT, updated_at TEXT, fetched_at TEXT);
messages  (session_id TEXT, cursor TEXT, payload JSON, created_at TEXT,
           PRIMARY KEY (session_id, cursor));
meta      (key TEXT PK, value TEXT);  -- last cursors, cache schema version
```
Zustand (persisted via MMKV/AsyncStorage — NON-sensitive only): pinned session IDs, filter prefs, theme, polling mode, analytics opt-in, composer templates (prompts only — templates must never store secret values; enforce in the type).
Keychain (expo-secure-store): `devin_api_key`, `devin_org_id`, `attribution_user_id`, `auth_kind`. Nothing else, nowhere else.

---

## 10. Security Requirements (Gates — every one blocks ship)

1. **Secrets:** API key/PAT only ever in Keychain with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility; excluded from iCloud/device backups. Grep-gate in CI: no `cog_` pattern, no key variable names outside `/src/auth`.
2. **No secret leakage:** v1 bundles no crash-reporting or analytics SDK. The local diagnostic boundary never logs or transmits errors. Its tested scrubber removes Authorization headers, key-shaped strings, identifiers, and message content and is mandatory before any future reporting provider can be proposed.
3. **Transport:** Devin Cloud remains TLS-only. The v1 Connector uses Tailscale only and may use HTTP solely to a canonical explicit-port `100.64.0.0/10` address because Tailscale WireGuard encrypts that path; the sole ATS exception is scoped to that range, and signed device requests, replay protection, rate limits, and server-side authorization remain mandatory. The Connector never falls back to LAN or public transport.
4. **Least privilege by design:** onboarding actively instructs users to create a scoped service user (session-use + read perms only). The app must function gracefully when permissions are missing (feature-gated UI, not crashes).
5. **Session content is code:** treat every fetched message as potentially containing the user's proprietary source. Never in analytics, never in logs, cache encrypted / OS file-protected, cache purged on disconnect and verifiably so (test asserts empty DB + empty Keychain after logout).
6. **Screen privacy:** mark credential fields `secureTextEntry`; add app-switcher snapshot blur on screens showing session content (privacy overlay on background).
7. **Input validation:** zod on every boundary (in AND out — composer payloads validated before send); attachment size/type limits client-side.
8. **Supply chain:** lockfile committed, Dependabot on, `npm audit` gate in CI (fail on high/critical), no dependency added without CI passing, secret scanning + push protection on the repo.
9. **Deep links:** `devinx://session/{id}` validates the ID format and requires an authenticated state; no auth material ever accepted via URL.
10. **Phase 2 notifier (when built):** separate read-only service key, provided by the user, stored server-side encrypted (KMS/env), org ID hashed in KV, device tokens purgeable via in-app toggle, notifier holds NO message content — payloads are "Session {title} needs input," never the question text. Its own mini spec + review before build.
11. **Voice:** every §7.8.4 gate blocks Session 4b release. Audio never leaves the device; temp files are protected and verifiably deleted; transcript content is scrubbed from diagnostics; microphone access is explicit and visible.

---

## 11. Testing & Release

### 11.1 Testing Matrix
| Category | What | Minimum |
|---|---|---|
| Unit | zod schemas, polling policy, backoff math, auth strategies, cache purge | All schemas + all policy branches |
| Integration | endpoint functions vs MSW mock of Devin API (fixtures from real doc examples) | Every endpoint in §8.5, incl. 401/403/429/5xx paths |
| E2E (Maestro) | onboard → validate → board → open session → send message → archive → disconnect-wipes-everything | The golden path + the wipe test |
| Security | key-leak grep gate, diagnostic scrub/no-transmission test, logout wipe assertion, deep-link fuzz | All pass in CI |
| Performance | cold start <2s to cached board; 60fps list scroll with 200 sessions; battery: Balanced polling <2%/hr foreground | Measured on a real mid-tier device |
| Voice unit | hint caps/secret exclusion, filler cleanup, template output, engine interface conformance | Every branch |
| Voice integration | five technical fixtures end-to-end with WER compared to the approved 4a record | No regression beyond approved bounds |
| Voice security | no-network-imports, temp-audio deletion, transcript scrubber | All pass in CI |
| Voice E2E | mic → injected fixture → transcript → scribe preview → send; denial and interruption paths | Golden path + both failures |
| Voice performance/accessibility | real-time factor ≤1.0 on iPhone 13-class, 60fps streaming, memory ceiling recorded, VoiceOver/Switch Control/Reduce Motion | Measured on device |

### 11.2 Release Checklist (App Store additions to standard gates)
- [ ] All §10 gates green in CI
- [ ] Disconnect verifiably wipes Keychain + SQLite + query cache
- [ ] Rate-limit behavior tested against real API (burst + sustained)
- [ ] App Privacy label accurate: Data Not Collected (or "Usage Data, opt-in" if PostHog on) — this label is a marketing asset, protect it
- [ ] Trademark disclaimer present in listing + in-app
- [ ] TestFlight external group live; crash-free rate >99.5% over 7 days before App Store submit
- [ ] Screenshots: dark theme, Board with a blocked session visible (show the killer feature)
- [ ] Rollback plan: EAS Update (OTA) for JS-level issues, <15min

---

## 12. Devin Session Plan (The Handoff)

One session per phase. Each session: reads `/specs/000-build-spec.md` + its phase spec + the `/specs/reference-ui/` screenshots, works on a branch `devin/phase-N-*`, ends in ONE PR with passing CI **and side-by-side parity screenshots per §5.4.6**. Create a Playbook from Phase 1's session prompt once it succeeds. Add a Knowledge note: "DevinX repo: TypeScript strict, no raw hex outside tokens.ts, secrets only in /src/auth, every API boundary zod-parsed, follow /specs."

**Session 0 — Foundation & Ground Truth** (small, do first)
> Read /specs/000-build-spec.md. Tasks: (1) Execute the full §5.0 UI audit of app.devin.ai and cognition.com — tokens, component anatomy, status vocabulary, and reference screenshots to /specs/reference-ui/; write /specs/design-tokens.md and /src/theme/tokens.ts. This audit is the design spec for the entire build (§5.4). (2) Fetch docs.devin.ai/llms.txt, crawl v3 API reference, generate /src/api/devin/types.ts + zod schemas per §8.3; note any deltas from §2.3/§8.5 in /specs/api-deltas.md. (3) Scaffold the Expo project per §6 with CI workflow, branch protection config note, .env.example, ESLint/Prettier/strict tsconfig, NativeWind + tokens wired, and the local §10.2 diagnostic boundary. PR with all three.

**Session 1 — Auth + Golden Path** (proves the architecture)
> Build §7.1 onboarding, §8.2 auth strategies (ServiceUserAuth live, PatAuth flag-gated), the client layer (§8.1, §8.4), and a minimal Session Board reading the real list endpoint. Golden path: connect → validate → see real sessions → disconnect wipes everything (write the wipe test). Every §10 gate that applies must have a test. One PR.

**Session 2 — Session Board complete** — filters, sections, blocked-first treatment (§7.4 list half), context menus, pins, pull-to-refresh, adaptive polling, offline cache + staleness banner, empty/error/unauth states.

**Session 3 — Session Detail + Steering** — timeline with cursor pagination, markdown/code rendering, composer with wake-warning, attachments download, Output tab (PRs, structured output, insights), archive/terminate flows.

**Session 4 — Composer + Usage + Settings** — §7.5 full composer with attachments upload and session-secret hygiene, §7.6 consumption views with permission-gating, §7.7 settings incl. privacy explainer.

**Session 4a — Voice Spec Analysis** — execute §7.8.1. Deliver only `/specs/007-voice-spec-analysis.md` plus throwaway `/spikes/voice/` benchmark assets. Mark reviews and approves the engine, packaging, and scribe-tier decision before implementation.

**Session 4b — Voice Spec Build** — after Session 4a approval, implement §7.8.2–§7.8.4, make the voice matrix green, and attach a speak → structure → send demo video to the PR. Add the voice golden path to Maestro and the on-device mic explanation to TestFlight review notes.

**Session 5 — Ship** — §11 testing matrix to green, Maestro E2E, performance passes, EAS build profiles, TestFlight submission config, App Store metadata drafts (with disclaimer), release checklist run. Output: TestFlight build.

**Session 6 (Phase 2, post-meetup, demand-gated)** — Notifier mini-spec first (§10.10), then Vercel service + Expo Push integration + in-app watch toggles.

**Session 7 (Phase 3A, required before public release)** — ACP discovery and threat model: negotiate `devin acp` capabilities, verify read-only session discovery on pinned CLI versions, specify pairing/auth/permissions, and build a localhost-only probe. No network listener or session mutation until the threat-model gate passes.

**Session 8 (Phase 3B, required before public release)** — macOS Computer Connection: a user-controlled bridge wrapping the supported ACP subprocess, QR pairing, per-device credentials and permissions, read-only session browsing first, then explicitly authorized message steering. LAN/Tailscale follows localhost validation; public tunnels and relays remain deferred.

**Session 9 (Phase 4A, required before public local-computer release)** — DevinX Connector: replace the terminal-only development runner with a signed, notarized macOS companion that detects Devin for Terminal and Tailscale, renders QR pairing locally, handles explicit device permissions, and provides visible per-user background lifecycle controls. Keep the bridge core platform-neutral and define secure-storage/service adapters for required Windows and Linux follow-up releases. No manual server URL or shared-password flow.

---

## 13. MoSCoW Summary

**Must (MVP/TestFlight):** connect/validate/Keychain, session board with blocked-first triage, session detail + message steering, new session composer (prompt/playbook/tags/ACU), archive/terminate, adaptive polling, offline cache, disconnect-wipe, dark theme with extracted tokens, approved on-device dictation + deterministic scribe fallback, all §10 gates.
**Should (≤30 days post):** consumption view, insights, attachments both directions, light theme polish, Android build, composer templates.
**Could:** push notifier (Phase 2), scheduled sessions management, PAT mode GA flip, iPad layout, widgets (blocked-session count on home screen — sleeper hit), Apple Watch glance.
**Won't (write it down):** undocumented Devin Desktop integration, scraping CLI/Desktop files or IPC, enterprise/* endpoints, playbook/knowledge/secret WRITES, a DevinX-operated relay in v1, storing bridge session content on DevinX infrastructure, Android-first anything.

---

## 14. The Pitch Frame (for the Cognition conversation)

Devin is reachable from Slack, the web, and the API — but not natively from a phone, despite the async queue-work/review-output model being the most mobile-native agent workflow that exists. DevinX closes that gap using only the public API, with an architecture Cognition's own enterprise buyers would approve of: keys in the Keychain, least-privilege service users, nothing between the user and api.devin.ai, an App Store privacy label that reads "Data Not Collected." Built by a security GRC professional, with Devin, on Devin's own API — and shipped before the meetup.

Built in Charlotte. Useful everywhere.
