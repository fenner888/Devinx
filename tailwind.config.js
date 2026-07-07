/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Semantic tokens wired to /src/theme/tokens.ts via CSS variables.
        // NativeWind reads these from the `--color-*` custom properties set
        // by ThemeProvider. Raw hexes live ONLY in tokens.ts (spec §5.1).
        // Alpha is baked into the channel values (e.g. "255 255 255 / .9")
        // so we don't use <alpha-value> here — it would conflict.
        surface0: 'rgb(var(--color-surface0))',
        surface1: 'rgb(var(--color-surface1))',
        surface2: 'rgb(var(--color-surface2))',
        scrim: 'rgb(var(--color-scrim))',
        'text-hi': 'rgb(var(--color-text-hi))',
        'text-mid': 'rgb(var(--color-text-mid))',
        'text-low': 'rgb(var(--color-text-low))',
        'text-inverse': 'rgb(var(--color-text-inverse))',
        brand: 'rgb(var(--color-brand))',
        'brand-hover': 'rgb(var(--color-brand-hover))',
        running: 'rgb(var(--color-running))',
        blocked: 'rgb(var(--color-blocked))',
        finished: 'rgb(var(--color-finished))',
        failed: 'rgb(var(--color-failed))',
        sleeping: 'rgb(var(--color-sleeping))',
        destructive: 'rgb(var(--color-destructive))',
        link: 'rgb(var(--color-link))',
        merged: 'rgb(var(--color-merged))',
        border: 'rgb(var(--color-border))',
        'border-subtle': 'rgb(var(--color-border-subtle))',
        'tint-primary': 'rgb(var(--color-tint-primary))',
        'tint-secondary': 'rgb(var(--color-tint-secondary))',
        'tint-tertiary': 'rgb(var(--color-tint-tertiary))',
        'tint-orange': 'rgb(var(--color-tint-orange))',
        'tint-green': 'rgb(var(--color-tint-green))',
        'tint-red': 'rgb(var(--color-tint-red))',
        'tint-purple': 'rgb(var(--color-tint-purple))',
        'tint-blue': 'rgb(var(--color-tint-blue))',
      },
      borderRadius: {
        // [FALLBACK-REPLACED §5.3] 12/10/8 → 6/4/9999 (Devin's live scale)
        card: '6px',
        input: '6px',
        button: '6px',
        tab: '6px',
        chip: '9999px',
        dot: '9999px',
        inlineCode: '4px',
        sheet: '20px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
        ],
        mono: ['SF Mono', 'Roboto Mono', 'JetBrains Mono', 'ui-monospace'],
      },
      fontSize: {
        // [FALLBACK-REPLACED §5.2] 15/17/20/24/28 → 12/13/14/16/17
        text12: ['12px', { lineHeight: '16px' }],
        text13: ['13px', { lineHeight: '18px' }],
        text14: ['14px', { lineHeight: '20px' }],
        text16: ['16px', { lineHeight: '22px' }],
        text17: ['17px', { lineHeight: '22px', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
