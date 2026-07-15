# DevinX Design Tokens — Ground Truth from app.devin.ai + cognition.com

> Extracted live on 2026-07-07 by automating a real authenticated session of
> `app.devin.ai` (Mark Fenner's account) and the public `cognition.com` site.
> Source screenshots live in `/specs/reference-ui/`. Every value below is
> computed from the running app unless explicitly marked `[FALLBACK]`.
>
> Method: puppeteer-core attached to a Chrome with `--remote-debugging-port=9223`;
> `getComputedStyle` on representative elements; CSS custom properties read
> from the compiled Tailwind stylesheet `assets/index-DK7dazMV.css`; status
> vocabulary read from the minified JS bundle `assets/index-D_00ULvv.js`.

## 1. Theme system

Devin's web app uses **Tailwind utility classes backed by CSS custom properties**
that swap between `.dark` and `.light` (with a `.theme-inverse` modifier).
The raw channel triplets (`R G B` / `R G B / alpha`) live on `.dark` / `.light`
and are surfaced as `rgb(var(--token))` on `:root`. DevinX mirrors this exact
structure so a future port to web-Tailwind is a copy/paste.

**Default theme: dark.** `document.documentElement.className` includes `dark`.
A `devin-webapp-theme` localStorage key (`"system" | "dark" | "light"`) drives
the toggle. Light theme follows system preference.

### 1.1 Surface layers (background)

| Token (Devin)        | Dark (RGB channels)     | Light (RGB channels)    | Hex (dark) | Hex (light) | DevinX semantic name |
|----------------------|-------------------------|-------------------------|------------|-------------|----------------------|
| Product canvas       | `0 0 0`                 | `252 252 252`           | `#000000`  | `#FCFCFC`   | `canvas`             |
| `--bg-page`          | `20 20 20`              | `252 252 252`           | `#141414`  | `#FCFCFC`   | `surface0`           |
| `--bg-wash`          | `25 25 25`              | `248 248 248`           | `#191919`  | `#F8F8F8`   | `surface1`           |
| `--bg-elevated`      | `31 31 31`              | `255 255 255`           | `#1F1F1F`  | `#FFFFFF`   | `surface2`           |
| `--bg-elevated-wax`  | `31 31 31 / .94`        | `255 255 255 / .94`     | `#1F1F1FF0`| `#FFFFFFF0` | `surface2Wax`        |
| `--bg-elevated-transparent` | `255 255 255 / .05` | `255 255 255`        | `#FFFFFF0D`| `#FFFFFF`   | `surface2Transparent`|
| DevinX floating composer | `31 31 31 / .72` | `255 255 255 / .84` | `#1F1F1FB8` | `#FFFFFFD6` | `composerSurface` |
| `--bg-scrim`         | `0 0 0 / .32`           | `0 0 0 / .12`           | `#00000052`| `#0000001F` | `scrim`              |
| `--bg-accent-neutral`| `249 249 249`           | `54 54 54`              | `#F9F9F9`  | `#363636`   | `surfaceAccentNeutral`|

**Note vs. spec §5.1 fallback:** the fallback palette assumed a *blue-tinted*
near-black (`#0B0E14`). Devin's actual surface is a **neutral near-black**
(`20 20 20` = `#141414`) with no blue tint. The blue accent is carried entirely
by `--bg-accent-primary` / `--text-accent-primary`. **Replacing the fallback
`surface0/1/2` hexes with the extracted neutral values — flagged in
`tokens.ts`.**

### 1.2 Text hierarchy

| Token (Devin)        | Dark                     | Light                  | Hex (dark)      | Hex (light)     | DevinX name        |
|----------------------|--------------------------|------------------------|-----------------|-----------------|--------------------|
| `--text-primary`     | `255 255 255 / .9`       | `25 25 25`             | `#FFFFFFE6`     | `#191919`       | `textHi`           |
| `--text-primary-strong` | `255 255 255`         | `0 0 0`                | `#FFFFFF`       | `#000000`       | `textHiStrong`     |
| `--text-secondary`   | `255 255 255 / .52`      | `25 25 25 / .56`       | `#FFFFFF85`     | `#1919198F`     | `textMid`          |
| `--text-disabled`    | `255 255 255 / .4`       | `25 25 25 / .4`        | `#FFFFFF66`     | `#19191966`     | `textLow`          |
| `--text-primary-inverse` | `0 0 0`              | `255 255 255`          | `#000000`       | `#FFFFFF`       | `textInverse`      |
| `--text-always-black`| `13 15 13`               | `13 15 13`             | `#0D0F0D`       | `#0D0F0D`       | `textAlwaysBlack`  |
| `--text-always-white`| `255 255 255`            | `255 255 255`          | `#FFFFFF`       | `#FFFFFF`       | `textAlwaysWhite`  |

### 1.3 Brand blue / accent

| Token (Devin)           | Dark          | Light         | Hex (dark) | Hex (light) | DevinX name        |
|--------------------------|---------------|---------------|------------|-------------|--------------------|
| `--bg-accent-primary`    | `68 137 255`  | `49 124 255`  | `#4489FF`  | `#317CFF`   | `brand`            |
| `--text-accent-primary`  | `73 176 255`  | `49 124 255`  | `#49B0FF`  | `#317CFF`   | `brandText`        |
| `--border-accent-primary`| `73 176 255`  | `49 124 255`  | `#49B0FF`  | `#317CFF`   | `brandBorder`      |
| `--bg-accent-secondary`  | `21 107 255 / .08` | `21 107 255 / .2` | `#156BFF14` | `#156BFF33` | `brandSecondaryBg` |
| `--tint-accent-secondary`| `68 137 255 / .05` | `49 124 255 / .08` | `#4489FF0D` | `#317CFF14` | `brandSecondaryTint`|

**Hover/pressed states:** Devin does **not** define a separate
`--bg-accent-primary-hover` token. Primary buttons use Tailwind
`disabled:opacity-50` and rely on the OS focus ring; hover is handled at the
component level via `hover:opacity-*` utilities (most common:
`hover:opacity-80`, `hover:opacity-100`). The spec's `brandHover`/`brandPressed`
fallbacks are therefore **not replaced by extracted values** — DevinX keeps the
fallback hexes for the press state and adds an `opacity-80` hover convention.
**Flagged in `tokens.ts`.**

### 1.4 Status colors

Devin exposes status colors as `--text-*` / `--bg-*` / `--tint-*` triples. The
**text** variant is the dot/label color; the **bg/tint** variants are the chip
fills (tint = ~8-12% alpha, bg = stronger).

| Status (DevinX)   | Token family | Dark (text)        | Light (text)       | Hex (dark) | Hex (light) |
|-------------------|--------------|--------------------|--------------------|------------|-------------|
| working / running | `--text-blue`* | `51 125 244`     | `51 125 244`       | `#337DF4`  | `#337DF4`   |
| blocked / waiting | `--text-orange` | `245 142 58`    | `245 142 58`       | `#F58E3A`  | `#F58E3A`   |
| finished / PR ready | `--text-green` | `0 236 126`     | `0 165 88`         | `#00EC7E`  | `#00A558`   |
| failed / crashed  | `--text-red`  | `245 59 58`        | `245 59 58`        | `#F53B3A`  | `#F53B3A`   |
| sleeping / archived | `--text-secondary` | (see §1.2) | (see §1.2)         | —          | —           |
| destructive       | `--text-destructive` / `--bg-destructive` | `245 59 58` | `245 59 58` | `#F53B3A` | `#F53B3A` |
| info / link       | `--text-link` | `62 184 237 / .85` | `13 133 185 / .85` | `#3EB8EDD9`| `#0D85B9D9`|
| purple (PR merged) | `--text-purple` | `149 108 222`   | `149 108 222`      | `#956CDE`  | `#956CDE`   |

\* The "working" status in the sidebar uses **no special color** when a session
is awake and actively working — it inherits `--text-primary`. The blue family
(`--text-blue`, `--bg-blue`, `--tint-blue`) is used for the **brand/accent**
CTAs and for the "Setting up" / progress states, not for the working dot. The
**working dot itself is brand blue** (`--bg-accent-primary` `#4489FF`). See
§2.2 for the exact mapping.

**Note vs. spec §5.1 fallback:** the fallback used `#3B82F6` for brand/running
and `#22C55E` for finished. Live values are `#4489FF` (brand) and `#00EC7E`
(finished, dark) / `#00A558` (light). **Replacing — flagged in `tokens.ts`.**

### 1.5 Borders

| Token (Devin)                  | Dark                | Light             | Hex (dark)  | Hex (light) |
|--------------------------------|---------------------|-------------------|-------------|-------------|
| `--border-primary`             | `255 255 255 / .08` | `0 0 0 / .1`      | `#FFFFFF14` | `#0000001A` |
| `--border-secondary`           | `255 255 255 / .04` | `0 0 0 / .08`     | `#FFFFFF0A` | `#00000014` |
| `--border-primary-strong`      | `255 255 255`       | `0 0 0`           | `#FFFFFF`   | `#000000`   |
| `--border-primary-always-black`| `0 0 0 / .08`       | `0 0 0 / .1`      | `#00000014` | `#0000001A` |

Border weight: **1px** everywhere (hairline). No 2px borders observed.

### 1.6 Radii

Observed computed `border-radius` values, by frequency:
- `6px` — buttons, tabs, sidebar items, cards (the dominant radius)
- `4px` — inline code, small chips
- `9999px` — status dots, pill chips (PR state badges, tag pills)
- `20px` — large sheet/modal corners (rare)
- `8px` — occasional elevated card

**Spec §5.3 fallback said 12px cards / 10px inputs / 8px chips. Live Devin uses
6px as the workhorse radius.** Replacing the fallback scale — flagged in
`tokens.ts`. Mobile touch targets will still respect 44pt minimums per §5.4.4.

### 1.7 Spacing

Devin uses Tailwind's default spacing scale (`1` = 4px). Observed paddings:
- Sidebar nav item: `px-[9px] py-[6px]`, radius `6px`
- Session row (sidebar "Recent" list): `pl-2 pr-1`, radius `6px`, gap `0.5`
- Tab: `h-[28px] px-[10px]`, radius `6px`
- Primary button: `px-4 py-2` (text-14) or `px-2 py-1` (text-13)
- Secondary/ghost button: `px-[8px]`, radius `6px`
- Status pill: `px-[10px] py-[4px]`, radius `9999px`
- Inline code: `px-1 py-px`, radius `4px`
- Chat message row: `px-5 py-3`
- Sidebar width: **300px**

### 1.8 Shadows

| Token            | Dark                                       | Light                                       |
|------------------|--------------------------------------------|--------------------------------------------|
| `--shadow-L1`    | `0 1px 2px 0 rgb(0 0 0 / .2)`              | (same)                                      |
| `--shadow-L2`    | `0 1px 3px 0 rgb(0 0 0 / .25), 0 1px 2px 0 #0000000f` | (same)                           |
| `--shadow-L3`    | `0 10px 15px -3px rgb(0 0 0 / .3), 0 4px 6px -2px #0000000d` | (same)                  |
| `--shadow-L4`    | `0 25px 50px -12px rgb(0 0 0 / .5)`        | (same)                                      |
| `--shadow-inner` | `inset 0 -1px 1px 0 #ffffff0a`             | `inset 1px 1px 1px 0 #0000001a`            |

**Spec §5.3 rule "borders over shadows in dark, soft shadows only in light" is
confirmed by the live app** — dark mode rarely uses shadows; light mode adds
the `--shadow-inner` inset for inputs.

### 1.9 Typography

**App font stack (computed on `body`, class `font-sf`):**
```
Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
```
**Mono stack (class `font-mono`, used on inline code, code blocks):**
```
"SF Mono", "Roboto Mono", ui-monospace, monospace
```
Devin also ships `--font-geist-sans` (`"Geist", "Geist Fallback"`) and
`--font-geist-mono` (`"Geist Mono", "Geist Mono Fallback"`) as available
families but **does not apply them to the app chrome** — Inter + SF Mono win.

**Spec §5.2 fallback said Inter + JetBrains Mono.** Live mono is **SF Mono /
Roboto Mono**, not JetBrains Mono. **Replacing the mono fallback — flagged in
`tokens.ts`.** (DevinX will bundle JetBrains Mono as a guaranteed-available
fallback because SF Mono is Apple-only and the app targets Android too; the
token will list SF Mono first to match Devin on iOS.)

**Type scale (observed computed `fontSize`):**
| Token name   | Size  | Weight | Usage                                  |
|--------------|-------|--------|----------------------------------------|
| `text-12`    | 12px  | 400/500| micro labels, status subtitle          |
| `text-13`    | 13px  | 400/500| body, buttons, tabs, chips, code       |
| `text-14`    | 14px  | 400    | composer, message body, primary body   |
| `text-15`    | 15px  | 400    | (cognition.com body)                   |
| `text-16`    | 16px  | 400    | default base, settings nav             |
| `text-17`    | 17px  | 600    | error page H1 (`font-semibold`)        |
| `text-36`    | 36px  | 400    | cognition.com H1 (serif)               |

**Spec §5.2 fallback scale was 15/17/20/24/28.** Live scale is denser
(12/13/14/16/17). **Replacing — flagged in `tokens.ts`.** Headings beyond 17px
were not observed in the app chrome (cognition.com uses 36px serif H1, kept as
the marketing-only `display` token).

Letter-spacing: `-0.2px` tracking on headings is **not** present in the app;
Devin uses default tracking. **Dropping the fallback tracking rule — flagged.**

---

## 2. Component anatomy

### 2.1 Session row (sidebar "Recent" list)

Reference: `01-home-composer.png`, `03b-session-timeline.png`.

```
<li class="group/button relative flex w-full cursor-pointer items-center gap-0.5
           pl-2 pr-1 ... rounded-[6px]">
  <status-dot class="size-2 rounded-full bg-text-{orange|red|green|purple}" />
  <title class="truncate text-13 text-text-primary" />
  <pr-badge class="rounded-[4px] px-0.5 text-text-{green|purple} hover:bg-text-{color}/70" />
  <time class="text-12 text-text-secondary" />   <!-- "12 days ago" -->
</li>
```
- Active row: `bg-tint-secondary` (`rgba(255,255,255,.05)` dark).
- Hover: `hover:bg-tint-secondary`.
- Status dot: 8px (`size-2`), `rounded-full`, color from `--text-*` family.
- PR badge: small `#N` pill, color = PR state (green=open, purple=merged),
  `rounded-[4px]`, `px-0.5`, hover darkens with `bg-text-{color}/70`.
- **Blocked-first sorting** is a DevinX deviation (§7.4) — Devin's sidebar
  shows "Recent" chronologically. Logged in `/specs/parity-deltas.md`.

### 2.2 Status indicator (dot + label)

The status dot is a `size-2 rounded-full` element whose background is one of:
- `bg-text-orange` (`#F58E3A`) — **blocked / needs input / exceeded limit**
- `bg-text-red` (`#F53B3A`) — **crashed / failed**
- `bg-text-green` (`#00EC7E` dark / `#00A558` light) — **PR ready / waiting for CI**
- `bg-text-purple` (`#956CDE`) — **PR merged**
- `bg-text-blue` (`#337DF4`) — **setting up / brand accent**
- (no dot color, inherits primary) — **working / awake**

The label color follows the same family via `text-text-{orange|red|green|purple}`.
**Status color + label always travel together** (§5.3 accessibility rule
confirmed by Devin's own implementation).

### 2.3 Status label vocabulary (EXACT — from `index-D_00ULvv.js`)

Devin's sidebar computes a `displayName` from session state. The canonical
map (`sne` object) and the activity sub-states (`nne` object):

**Top-level status labels** (the `displayName` shown next to the dot):
| Label                  | i18n key                          | When                                            |
|------------------------|-----------------------------------|-------------------------------------------------|
| `Working`              | `sidebar.status.working`          | awake, active, not done, no special state       |
| `PR is ready`          | `sidebar.status.prReady`          | finished + open PR                              |
| `PR ready, waiting for CI` | `sidebar.status.prReadyWaitingCI` | finished, open PR, CI pending                |
| `Waiting for CI`       | `sidebar.status.waitingForCI`     | activity `waiting_for_ci`                       |
| `Waiting for response` | `sidebar.status.waitingForResponse` | blocked loop pause / approval request         |
| `Exceeded limit`       | `sidebar.status.exceededLimit`    | `paused` + reason `done` (ACU/usage limit)      |
| `Crashed`              | `sidebar.status.crashed`          | error exit                                       |
| `Closed`               | `sidebar.status.closed`           | exit / closed PR, not done                       |
| `Done`                 | `sidebar.status.done`             | terminal `done`                                  |
| `Sleeping`             | `sidebar.status.sleeping`         | archived / not awake                             |
| `Setting up`           | `sidebar.status.settingUp`        | activity `setup`                                 |
| `Planning`             | `sidebar.status.planning`         | activity `planning`                              |
| `Coding`               | `sidebar.status.coding`           | activity `coding`                                |
| `Iterating`            | `sidebar.status.iterating`        | activity `pr`                                    |
| `Testing`              | `sidebar.status.testing`          | activity `testing`                               |
| `Approve session`      | `sidebar.status.approveSession`   | permission request, tool in `Ra` set             |
| `Approve deployment`   | `sidebar.status.approveDeployment`| permission_type `deploy`                         |
| `Approval required`    | `sidebar.status.approvalRequired` | other permission request                         |
| `Approve Knowledge`    | `sidebar.status.approveKnowledge` | (knowledge approval flow)                        |
| `Review PR`            | `sidebar.status.reviewPR`         | (review-requested flow)                          |

**Activity sub-states** (`nne`): `setup → Setting up`, `planning → Planning`,
`coding → Coding`, `pr → Iterating`, `testing → Testing`, `done → Done`.

**In-chat progress copy** (from `SessionsItemPage-ChTbhBKt.js`):
- working: `Devin is working…`
- waiting/blocked: `Devin is awaiting your response…`
- sleep transition: `Devin went to sleep`

**DevinX adoption (§5.0.6):** these strings are the canonical status
vocabulary. The mobile app uses them verbatim — no invented "Needs input" /
"PR ready" / "Sleeping" shorthand. The spec's fallback chip labels
(`● Working`, `● Needs input`, `● PR ready`, `● Sleeping`, `● Failed`) are
**replaced** by: `● Working`, `● Waiting for response`, `● PR is ready`,
`● Sleeping`, `● Crashed` (plus the full set above). **Flagged in `tokens.ts`
as `statusLabels`.**

### 2.4 Chat message bubbles

Reference: `03-session-completed-pr.png`, `03b-session-timeline.png`.

Devin does **not** use rounded "iMessage" bubbles. Messages are full-width rows
in a single column with subtle alignment cues:

**User message** (right-aligned content, left-aligned avatar column):
- Wrapper: `flex w-full flex-col gap-1 px-5 py-3`
- Bubble: `text-14 bg-tint-tertiary` (`rgba(255,255,255,.03)` dark),
  `border-radius: 16px 4px 16px 16px` (asymmetric — tail top-left),
  `text-text-primary`
- Avatar/name label above the bubble, `text-12 text-text-secondary`

**Devin message** (left-aligned, no bubble background):
- Wrapper: `px-5 py-3`
- Body: `prose-main prose-ds prose-ds-dense-v3 text-[13px] text-text-primary`
- No background, no border — distinguished by avatar + name label
- Markdown rendered; code blocks see §2.5

**Timestamps:** `text-12 text-text-secondary`, e.g. `Jun 25, 4:02 PM`.

**Sleep divider:** full-width row, `text-13 text-text-secondary`,
copy `Devin went to sleep`.

### 2.5 Code blocks

**Inline code:** `rounded font-mono text-[calc(1em-1px)] bg-tint-secondary
px-1 py-px`, radius `4px`, `bg rgba(255,255,255,.05)`, `text-text-primary`,
font `"SF Mono", "Roboto Mono", ui-monospace, monospace`, size `13px`.

**Fenced code block:** full-width, `bg-bg-elevated` (`#1F1F1F` dark),
`rounded-[6px]`, header bar with filename + copy button, line numbers optional.
Diff rendering uses the `d2h` (diff2html) library with its own CSS variables
(see `--d2h-*` in the extracted vars) — DevinX will reuse diff2html or a
React Native equivalent.

### 2.6 Tag chips / PR state pills

**PR state pill** (`Merged`, `Open`, `Closed`, `Draft`):
```
class="font-medium first-letter:capitalize inline-flex flex-shrink-0 w-fit
       items-center justify-center truncate bg-tint-{purple|green|red|secondary}
       text-text-{purple|green|red|secondary} rounded-full"
style="padding: 4px 10px; font-size: 13px; font-weight: 500;"
```
- `Open` → `bg-tint-green text-text-green`
- `Merged` → `bg-tint-purple text-text-purple`
- `Closed` → `bg-tint-red text-text-red` (inferred)
- `Draft` → `bg-tint-secondary text-text-secondary` (inferred)

**Session `#N` badge** (sidebar): `rounded-[4px] px-0.5`, color =
`text-text-green` (open) or `text-text-purple` (merged), hover
`bg-text-{color}/70`.

### 2.7 Buttons

**Primary** (e.g. `Merge`, `Sign in`):
```
class="inline-flex select-none font-medium max-w-full items-center justify-center
       overflow-hidden whitespace-nowrap outline-none disabled:opacity-50
       bg-bg-accent-primary text-text-always-white"
style="border: 1px solid rgba(0,0,0,.08); border-radius: 6px;
       padding: 0 10px; font-size: 13px; font-weight: 500;"
```
- bg `#4489FF` (dark) / `#317CFF` (light)
- text `#FFFFFF`
- radius `6px`, weight `500`
- disabled: `opacity-50`
- hover: `opacity-80` (convention, not a token)

**Secondary / ghost** (e.g. `Resume session`, `Review`):
```
class="... bg-tint-secondary text-text-primary"  /* or transparent */
style="border: 1px solid rgba(255,255,255,.08); border-radius: 6px;
       padding: 0 8px; font-size: 12px; font-weight: 500;"
```
- bg `rgba(255,255,255,.05)` dark / `rgba(0,0,0,.06)` light
- text `text-text-primary`
- border `--border-primary`

**Destructive:** `bg-bg-destructive text-text-always-white`
(`#F53B3A` bg, white text). Used for delete/terminate confirmations.

**Tab** (segmented control row):
```
class="text-text-secondary hover:bg-tint-secondary text-13 group h-[28px]
       whitespace-nowrap rounded-[6px] px-[10px] font-medium
       data-[active]:text-text-primary data-[active]:bg-tint-secondary"
```

### 2.8 Inputs / composer

**Composer** (Slate editor, `contenteditable`):
```
class="notranslate w-full rounded-sm bg-transparent text-14 text-text-primary
       outline-none focus:outline-none ..."
```
- transparent background, `text-14`, `text-text-primary`
- container provides `bg-tint-tertiary` + `rounded-[16px]` (the input area
  wrapper, not the editor itself)
- placeholder rendered via Slate `[data-slate-placeholder]` pseudo-element
- DevinX existing-session composers use the semantic translucent
  `composerSurface` token. Their outer safe-area shell remains transparent so
  it never reads as a separate opaque bottom bar.

**Settings inputs:** `--form-input-bg #00000008`, `--form-input-padding 6px 8px`,
`--form-input-font-size 16px`, `--form-label-font-size 13px`.

### 2.9 Empty states

Reference: `03-session-completed-pr.png` shows the in-chat empty state
(`Nice — PR #2 is merged. Nothing else is in progress.`).

Pattern: **plain `text-14 text-text-secondary` paragraph**, no illustration,
no large CTA. The composer's empty state is the placeholder text
(`Ask Devin to build features, fix bugs, or work on your code`).

**Spec §5.3 fallback called for "illustrated with a terminal-prompt motif, one
CTA."** Devin's actual empty states are quieter — text-only. DevinX will use a
**terminal-prompt motif** as a deliberate mobile-native addition (touch-first
empty states benefit from a visual anchor); this is a **deviation** to be
logged in `/specs/parity-deltas.md`. The copy tone (calm, first-person,
specific to the situation) is preserved.

### 2.10 Sidebar / app chrome

- Sidebar: `bg-bg-wash` (`#191919` dark), `border-border-secondary`,
  width `300px`, `flex flex-col overflow-hidden`
- Nav item: `rounded-[6px] px-[9px] py-[6px] text-13`,
  `hover:bg-tint-secondary`, `data-[popup-open]:bg-tint-secondary`
- Active route: `bg-tint-secondary`
- Top bar / session header: `bg-bg-page`, hairline `border-border-primary`
- Tab bar (session detail): row of `h-[28px]` tabs, gap `2px`

---

## 3. cognition.com (marketing brand — light theme soul)

Reference: `07-cognition-home.png`, `08-cognition-careers.png`,
`09-cognition-research.png`.

| Token            | Value                                   | Note                                  |
|------------------|-----------------------------------------|---------------------------------------|
| Page background  | `#F7F6F5` (`rgb(247,246,245)`)          | warm off-white / cream                |
| Page text        | `#000000`                               | near-black                            |
| Body text        | `lab(43.6883 -1.05676 -5.3435 / 0.8)`   | near-black at 80% opacity             |
| Secondary text   | `rgba(25, 25, 25, 0.56)`                | matches Devin's `--text-secondary`    |
| Accent           | `rgb(34, 0, 255)` = `#2200FF`           | electric violet-blue (marketing only) |
| Surface variant  | `#EDECEB`, `#F7F6F5`                    | subtle section bands                  |
| Border           | `rgba(0, 0, 0, 0.06)`                   | hairline                              |
| Display serif    | `stkBureauSerif, "stkBureauSerif Fallback"` | H1/body serif                     |
| UI sans          | `nbInternational, "nbInternational Fallback"` | nav/buttons sans                  |
| Mono             | `GeistMono, ui-monospace, SFMono-Regular, "Roboto Mono", Menlo, ...` | code/labels |
| H1 size          | `36px`                                  | serif                                 |
| Body size        | `15px`                                  | serif                                 |
| Radii            | **none** — cognition.com uses sharp corners | marketing brand is angular       |

**DevinX light theme:** the spec §5.1 fallback used `#FAF7F2` (Cognition
cream). The live cognition.com cream is `#F7F6F5` — slightly cooler.
**Replacing the light `surface0` fallback — flagged in `tokens.ts`.** The
electric violet `#2200FF` is **marketing-only** and is NOT used in DevinX's
app chrome (the app uses Devin's `--bg-accent-primary` `#317CFF` for light
brand). The violet is reserved for the optional waitlist site.

---

## 4. Tokens summary → `/src/theme/tokens.ts`

The tokens file encodes:
1. `dark` and `light` objects with the extracted RGB-channel values (so
   NativeWind can consume them as `rgb(var(--token))` style or as resolved
   hexes for RN).
2. `statusLabels` map (§2.3) — the exact vocabulary.
3. `radii`, `spacing`, `fonts`, `typeScale` constants.
4. Every value that **replaces a spec §5.1/§5.2/§5.3 fallback** is marked with
   a `// [FALLBACK-REPLACED]` comment citing this file's section.
5. Every value that is **kept as a fallback** (no live equivalent found) is
   marked with a `// [FALLBACK-KEPT]` comment with the reason.

See `/src/theme/tokens.ts`.
