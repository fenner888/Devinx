/**
 * DevinX design tokens — extracted from app.devin.ai + cognition.com on
 * 2026-07-07. See /specs/design-tokens.md for the full audit and
 * /specs/reference-ui/ for screenshots.
 *
 * Convention:
 *   // [FALLBACK-REPLACED §X.Y]  — spec §5 fallback value replaced by live extraction
 *   // [FALLBACK-KEPT §X.Y]      — no live equivalent; spec fallback retained
 *
 * Raw hex ONLY appears in this file (spec §5.1 rule). Components consume
 * semantic tokens.
 *
 * Devin's web app stores colors as `R G B` channel triplets and surfaces them
 * via `rgb(var(--token))`. We mirror that here: each color is stored as a
 * channel string (`"20 20 20"`) AND a resolved hex (`#141414`) so NativeWind
 * (which needs real values, not CSS vars) and any future web port both work.
 */

export type ThemeName = 'dark' | 'light';

export interface ColorToken {
  /** RGB channels, space-separated, matching Devin's `--token` raw form. */
  channels: string;
  /** Resolved hex (alpha baked in where applicable). */
  hex: string;
}

export interface ThemeTokens {
  /** Full-screen canvas used where the product calls for true black in dark mode. */
  canvas: ColorToken;
  /** App background (Devin `--bg-page`). */
  surface0: ColorToken;
  /** Cards / sidebar / list rows (Devin `--bg-wash`). */
  surface1: ColorToken;
  /** Elevated: sheets, menus, inputs (Devin `--bg-elevated`). */
  surface2: ColorToken;
  /** Elevated with wax (sticky headers) — 94% opacity. */
  surface2Wax: ColorToken;
  /** Transparent elevated (over-content overlays). */
  surface2Transparent: ColorToken;
  /** Translucent floating composer surface. */
  composerSurface: ColorToken;
  /** Home companion stage: quiet planetary surface behind Devin. */
  companionStageSurface: ColorToken;
  /** Home companion stage: broad ambient halo. */
  companionStageGlow: ColorToken;
  /** Home companion stage: horizon and orbital line. */
  companionStageLine: ColorToken;
  /** Home companion stage: sparse atmospheric points. */
  companionStageStar: ColorToken;
  /** Modal scrim / overlay backdrop. */
  scrim: ColorToken;
  /** Neutral accent surface (rare). */
  surfaceAccentNeutral: ColorToken;

  /** Primary text (Devin `--text-primary`, 90% white / near-black). */
  textHi: ColorToken;
  /** Strong primary text (Devin `--text-primary-strong`, 100%). */
  textHiStrong: ColorToken;
  /** Secondary text — timestamps, subtitles (Devin `--text-secondary`). */
  textMid: ColorToken;
  /** Disabled / placeholders (Devin `--text-disabled`). */
  textLow: ColorToken;
  /** Inverse text on accent fills (Devin `--text-primary-inverse`). */
  textInverse: ColorToken;
  /** Always-black text (for accent buttons' secondary line). */
  textAlwaysBlack: ColorToken;
  /** Always-white text (for accent buttons' primary line). */
  textAlwaysWhite: ColorToken;

  /** Brand blue — CTAs, active states (Devin `--bg-accent-primary`). */
  brand: ColorToken;
  /** Brand blue for text/links (Devin `--text-accent-primary`). */
  brandText: ColorToken;
  /** Brand blue for borders (Devin `--border-accent-primary`). */
  brandBorder: ColorToken;
  /** Brand secondary fill (Devin `--bg-accent-secondary`). */
  brandSecondaryBg: ColorToken;
  /** Brand secondary tint (Devin `--tint-accent-secondary`). */
  brandSecondaryTint: ColorToken;
  /**
   * Brand hover. Devin has NO dedicated hover token; buttons use
   * `hover:opacity-80`. We keep a slightly lighter blue for pressed states.
   * [FALLBACK-KEPT §1.3] no live --bg-accent-primary-hover exists.
   */
  brandHover: ColorToken;
  /** Brand pressed (darker). [FALLBACK-KEPT §1.3] no live token. */
  brandPressed: ColorToken;

  /** Status: working / running dot — uses brand blue. */
  running: ColorToken;
  /** Status: blocked / needs input (Devin `--text-orange`). */
  blocked: ColorToken;
  /** Status: finished / PR ready (Devin `--text-green`). */
  finished: ColorToken;
  /** Status: failed / crashed (Devin `--text-red`). */
  failed: ColorToken;
  /** Status: sleeping / archived — uses textMid. */
  sleeping: ColorToken;
  /** Destructive actions (Devin `--bg-destructive`). */
  destructive: ColorToken;
  /** Info / link (Devin `--text-link`). */
  link: ColorToken;
  /** PR merged (Devin `--text-purple`). */
  merged: ColorToken;

  /** Hairline border (Devin `--border-primary`). */
  border: ColorToken;
  /** Subtler border (Devin `--border-secondary`). */
  borderSubtle: ColorToken;
  /** Strong border (Devin `--border-primary-strong`). */
  borderStrong: ColorToken;

  /** Tint: primary (Devin `--tint-primary`, ~8% white/black). */
  tintPrimary: ColorToken;
  /** Tint: secondary (Devin `--tint-secondary`, ~5%). */
  tintSecondary: ColorToken;
  /** Tint: tertiary (Devin `--tint-tertiary`, ~3%). */
  tintTertiary: ColorToken;
  /** Tint: orange (blocked chip fill). */
  tintOrange: ColorToken;
  /** Tint: green (finished chip fill). */
  tintGreen: ColorToken;
  /** Tint: red (failed chip fill). */
  tintRed: ColorToken;
  /** Tint: purple (merged chip fill). */
  tintPurple: ColorToken;
  /** Tint: blue (brand chip fill). */
  tintBlue: ColorToken;
  /** Chart accent: amber (M-size bucket in analytics). */
  chartAmber: ColorToken;
}

const c = (channels: string, hex: string): ColorToken => ({ channels, hex });

// [FALLBACK-REPLACED §1.1] surface0 #0B0E14 → #141414 (Devin --bg-page dark)
// [FALLBACK-REPLACED §1.1] surface1 #11151F → #191919 (Devin --bg-wash dark)
// [FALLBACK-REPLACED §1.1] surface2 #1A2029 → #1F1F1F (Devin --bg-elevated dark)
export const dark: ThemeTokens = {
  canvas: c('0 0 0', '#000000'),
  surface0: c('20 20 20', '#141414'),
  surface1: c('25 25 25', '#191919'),
  surface2: c('31 31 31', '#1F1F1F'),
  surface2Wax: c('31 31 31 / .94', '#1F1F1FF0'),
  surface2Transparent: c('255 255 255 / .05', '#FFFFFF0D'),
  composerSurface: c('31 31 31 / .72', '#1F1F1FB8'),
  companionStageSurface: c('4 16 43', '#04102B'),
  companionStageGlow: c('68 137 255 / .14', '#4489FF24'),
  companionStageLine: c('73 176 255 / .72', '#49B0FFB8'),
  companionStageStar: c('73 176 255 / .7', '#49B0FFB3'),
  scrim: c('0 0 0 / .32', '#00000052'),
  surfaceAccentNeutral: c('249 249 249', '#F9F9F9'),

  // [FALLBACK-REPLACED §1.2] textHi #F2F5F9 → #FFFFFFE6 (Devin --text-primary, 90%)
  textHi: c('255 255 255 / .9', '#FFFFFFE6'),
  textHiStrong: c('255 255 255', '#FFFFFF'),
  // [FALLBACK-REPLACED §1.2] textMid #9AA6B5 → #FFFFFF85 (Devin --text-secondary, 52%)
  textMid: c('255 255 255 / .52', '#FFFFFF85'),
  // [FALLBACK-REPLACED §1.2] textLow #5C6875 → #FFFFFF66 (Devin --text-disabled, 40%)
  textLow: c('255 255 255 / .4', '#FFFFFF66'),
  textInverse: c('0 0 0', '#000000'),
  textAlwaysBlack: c('13 15 13', '#0D0F0D'),
  textAlwaysWhite: c('255 255 255', '#FFFFFF'),

  // [FALLBACK-REPLACED §1.3] brand #3B82F6 → #4489FF (Devin --bg-accent-primary dark)
  brand: c('68 137 255', '#4489FF'),
  brandText: c('73 176 255', '#49B0FF'),
  brandBorder: c('73 176 255', '#49B0FF'),
  brandSecondaryBg: c('21 107 255 / .08', '#156BFF14'),
  brandSecondaryTint: c('68 137 255 / .05', '#4489FF0D'),
  // [FALLBACK-KEPT §1.3] Devin has no hover token; uses opacity-80 convention.
  brandHover: c('91 154 255', '#5C9AFF'),
  // [FALLBACK-KEPT §1.3] Devin has no pressed token.
  brandPressed: c('51 110 230', '#336EE6'),

  // [FALLBACK-REPLACED §1.4] running #3B82F6 → #4489FF (brand blue, working dot)
  running: c('68 137 255', '#4489FF'),
  // [FALLBACK-REPLACED §1.4] blocked #F59E0B → #F58E3A (Devin --text-orange)
  blocked: c('245 142 58', '#F58E3A'),
  // [FALLBACK-REPLACED §1.4] finished #22C55E → #00EC7E (Devin --text-green dark)
  finished: c('0 236 126', '#00EC7E'),
  // [FALLBACK-REPLACED §1.4] failed #EF4444 → #F53B3A (Devin --text-red)
  failed: c('245 59 58', '#F53B3A'),
  sleeping: c('255 255 255 / .52', '#FFFFFF85'), // = textMid
  destructive: c('245 59 58', '#F53B3A'),
  link: c('62 184 237 / .85', '#3EB8EDD9'),
  merged: c('149 108 222', '#956CDE'),

  // [FALLBACK-REPLACED §1.5] border #232B38 → #FFFFFF14 (Devin --border-primary, 8% white)
  border: c('255 255 255 / .08', '#FFFFFF14'),
  borderSubtle: c('255 255 255 / .04', '#FFFFFF0A'),
  borderStrong: c('255 255 255', '#FFFFFF'),

  tintPrimary: c('255 255 255 / .08', '#FFFFFF14'),
  tintSecondary: c('255 255 255 / .05', '#FFFFFF0D'),
  tintTertiary: c('255 255 255 / .03', '#FFFFFF08'),
  tintOrange: c('245 142 58 / .08', '#F58E3A14'),
  tintGreen: c('0 236 126 / .08', '#00EC7E14'),
  tintRed: c('245 59 58 / .12', '#F53B3A1F'),
  tintPurple: c('149 108 222 / .12', '#956CDE1F'),
  tintBlue: c('51 125 244 / .1', '#337DF41A'),
  chartAmber: c('245 195 58', '#F5C33A'),
};

// [FALLBACK-REPLACED §1.1] surface0 #FAF7F2 → #FCFCFC (Devin --bg-page light)
//   cognition.com cream #F7F6F5 is marketing-only; app light uses #FCFCFC.
// [FALLBACK-REPLACED §1.1] surface1 #FFFFFF → #F8F8F8 (Devin --bg-wash light)
// [FALLBACK-REPLACED §1.1] surface2 #F1EDE6 → #FFFFFF (Devin --bg-elevated light)
export const light: ThemeTokens = {
  canvas: c('252 252 252', '#FCFCFC'),
  surface0: c('252 252 252', '#FCFCFC'),
  surface1: c('248 248 248', '#F8F8F8'),
  surface2: c('255 255 255', '#FFFFFF'),
  surface2Wax: c('255 255 255 / .94', '#FFFFFFF0'),
  surface2Transparent: c('255 255 255', '#FFFFFF'),
  composerSurface: c('255 255 255 / .84', '#FFFFFFD6'),
  companionStageSurface: c('230 239 255', '#E6EFFF'),
  companionStageGlow: c('49 124 255 / .1', '#317CFF1A'),
  companionStageLine: c('49 124 255 / .42', '#317CFF6B'),
  companionStageStar: c('37 99 235 / .3', '#2563EB4D'),
  scrim: c('0 0 0 / .12', '#0000001F'),
  surfaceAccentNeutral: c('54 54 54', '#363636'),

  // [FALLBACK-REPLACED §1.2] textHi #16181D → #191919 (Devin --text-primary light)
  textHi: c('25 25 25', '#191919'),
  textHiStrong: c('0 0 0', '#000000'),
  // Accessibility override: the extracted 56% value is only 4.03:1 on the
  // light canvas. 60% preserves the hierarchy while clearing WCAG AA text.
  textMid: c('25 25 25 / .6', '#19191999'),
  textLow: c('25 25 25 / .4', '#19191966'),
  textInverse: c('255 255 255', '#FFFFFF'),
  textAlwaysBlack: c('13 15 13', '#0D0F0D'),
  textAlwaysWhite: c('255 255 255', '#FFFFFF'),

  // [FALLBACK-REPLACED §1.3] brand #2563EB → #317CFF (Devin --bg-accent-primary light)
  brand: c('49 124 255', '#317CFF'),
  // Accessibility override: keep the extracted blue for fills, but use a
  // darker semantic link/text blue that clears 4.5:1 on light surfaces.
  brandText: c('37 99 235', '#2563EB'),
  brandBorder: c('49 124 255', '#317CFF'),
  brandSecondaryBg: c('21 107 255 / .2', '#156BFF33'),
  brandSecondaryTint: c('49 124 255 / .08', '#317CFF14'),
  // [FALLBACK-KEPT §1.3]
  brandHover: c('29 78 216', '#1D4ED8'),
  // [FALLBACK-KEPT §1.3]
  brandPressed: c('23 64 175', '#1740AF'),

  // [FALLBACK-REPLACED §1.4] running #2563EB → #317CFF (brand light)
  running: c('49 124 255', '#317CFF'),
  // [FALLBACK-REPLACED §1.4] blocked #B45309 → #F58E3A (Devin --text-orange, same as dark)
  blocked: c('245 142 58', '#F58E3A'),
  // [FALLBACK-REPLACED §1.4] finished #15803D → #00A558 (Devin --text-green light)
  finished: c('0 165 88', '#00A558'),
  // [FALLBACK-REPLACED §1.4] failed #DC2626 → #F53B3A (Devin --text-red, same as dark)
  failed: c('245 59 58', '#F53B3A'),
  sleeping: c('25 25 25 / .56', '#1919198F'), // = textMid
  destructive: c('245 59 58', '#F53B3A'),
  link: c('13 133 185 / .85', '#0D85B9D9'),
  merged: c('149 108 222', '#956CDE'),

  // [FALLBACK-REPLACED §1.5] border #E4DFD5 → #0000001A (Devin --border-primary light, 10% black)
  border: c('0 0 0 / .1', '#0000001A'),
  borderSubtle: c('0 0 0 / .08', '#00000014'),
  borderStrong: c('0 0 0', '#000000'),

  tintPrimary: c('0 0 0 / .08', '#00000014'),
  tintSecondary: c('0 0 0 / .06', '#0000000F'),
  tintTertiary: c('0 0 0 / .04', '#0000000A'),
  tintOrange: c('245 142 58 / .12', '#F58E3A1F'),
  tintGreen: c('62 237 155 / .2', '#3EED9B33'),
  tintRed: c('245 59 58 / .12', '#F53B3A1F'),
  tintPurple: c('149 108 222 / .12', '#956CDE1F'),
  tintBlue: c('51 125 244 / .1', '#337DF41A'),
  chartAmber: c('212 160 23', '#D4A017'),
};

/**
 * Status label vocabulary — EXACT strings from app.devin.ai
 * (bundle `index-D_00ULvv.js`, `sne` + `nne` maps).
 * [FALLBACK-REPLACED §2.3] spec fallback labels replaced by live vocabulary.
 *
 * Mobile shows the short label next to the status dot. The full set is
 * available for the session detail header.
 */
export const statusLabels = {
  working: 'Working',
  prReady: 'PR is ready',
  prReadyWaitingCI: 'PR ready, waiting for CI',
  waitingForCI: 'Waiting for CI',
  waitingForResponse: 'Waiting for response',
  exceededLimit: 'Exceeded limit',
  crashed: 'Crashed',
  closed: 'Closed',
  done: 'Done',
  sleeping: 'Sleeping',
  settingUp: 'Setting up',
  planning: 'Planning',
  coding: 'Coding',
  iterating: 'Iterating',
  testing: 'Testing',
  approveSession: 'Approve session',
  approveDeployment: 'Approve deployment',
  approvalRequired: 'Approval required',
  approveKnowledge: 'Approve Knowledge',
  reviewPR: 'Review PR',
} as const;

export type StatusLabelKey = keyof typeof statusLabels;

/** In-chat progress copy (from SessionsItemPage bundle). */
export const progressCopy = {
  working: 'Devin is working…',
  waiting: 'Devin is awaiting your response…',
  wentToSleep: 'Devin went to sleep',
} as const;

/**
 * Radii.
 * [FALLBACK-REPLACED §5.3] 12/10/8 → 6/4/9999 (Devin's live scale).
 *   card: 6px (was 12), input: 6px (was 10), chip: 9999px (was 8),
 *   inlineCode: 4px, sheet: 20px.
 */
export const radii = {
  card: 6,
  input: 6,
  button: 6,
  tab: 6,
  chip: 9999,
  dot: 9999,
  inlineCode: 4,
  sheet: 20,
} as const;

/**
 * Spacing (Tailwind 4px base). Key paddings observed in the live app.
 */
export const spacing = {
  /** Sidebar nav item: px 9, py 6 */
  navItemX: 9,
  navItemY: 6,
  /** Tab: h 28, px 10 */
  tabHeight: 28,
  tabX: 10,
  /** Primary button: px 16 (px-4), py 8 (py-2) for text-14 */
  buttonPrimaryX: 16,
  buttonPrimaryY: 8,
  /** Secondary button: px 8 */
  buttonSecondaryX: 8,
  /** Status pill: px 10, py 4 */
  pillX: 10,
  pillY: 4,
  /** Inline code: px 4 (px-1), py 1 (py-px) */
  inlineCodeX: 4,
  inlineCodeY: 1,
  /** Chat message row: px 20 (px-5), py 12 (py-3) */
  messageX: 20,
  messageY: 12,
  /** Sidebar width */
  sidebarWidth: 300,
} as const;

/**
 * Typography.
 * [FALLBACK-REPLACED §5.2] mono "JetBrains Mono" → "SF Mono","Roboto Mono" first
 *   (Devin's live font-mono stack). JetBrains Mono kept as a bundled fallback
 *   for Android where SF Mono is unavailable.
 * [FALLBACK-REPLACED §5.2] type scale 15/17/20/24/28 → 12/13/14/16/17 (Devin's
 *   live computed sizes). 36px display kept for cognition.com-style marketing
 *   only (not app chrome).
 * [FALLBACK-KEPT §5.2] tabular figures — not extractable from CSS; retained
 *   as a component-level `font-variant-numeric: tabular-nums` rule.
 */
export const fonts = {
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  mono: '"SF Mono", "Roboto Mono", "JetBrains Mono", ui-monospace, monospace',
  /** cognition.com marketing serif — NOT used in app chrome. */
  displaySerif: 'stkBureauSerif, "stkBureauSerif Fallback"',
  /** cognition.com marketing sans — NOT used in app chrome. */
  displaySans: 'nbInternational, "nbInternational Fallback"',
} as const;

export const typeScale = {
  text12: 12,
  text13: 13,
  text14: 14,
  text16: 16,
  text17: 17,
  /** Marketing only (cognition.com H1). */
  display36: 36,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;

/**
 * Shadows (Devin --shadow-L*). Same in both themes except --shadow-inner.
 */
export const shadows = {
  L1: '0px 1px 2px 0px rgb(0 0 0 / 0.2)',
  L2: '0px 1px 3px 0px rgb(0 0 0 / 0.25), 0px 1px 2px 0px #0000000f',
  L3: '0px 10px 15px -3px rgb(0 0 0 / 0.3), 0px 4px 6px -2px #0000000d',
  L4: '0px 25px 50px -12px rgb(0 0 0 / 0.5)',
  innerDark: 'inset 0px -1px 1px 0px #ffffff0a',
  innerLight: 'inset 1px 1px 1px 0px #0000001a',
} as const;

/**
 * Cognition marketing brand — used ONLY for the optional waitlist site,
 * NOT in the app chrome. App light theme uses Devin's --bg-accent-primary.
 */
export const cognitionMarketing = {
  cream: '#F7F6F5',
  textNearBlack: '#000000',
  accentViolet: '#2200FF',
  borderHairline: 'rgba(0, 0, 0, 0.06)',
} as const;

export const themes: Record<ThemeName, ThemeTokens> = { dark, light };
export const defaultTheme: ThemeName = 'dark';
