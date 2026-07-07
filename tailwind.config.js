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
        surface0: 'rgb(var(--color-surface0) / <alpha-value>)',
        surface1: 'rgb(var(--color-surface1) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
        scrim: 'rgb(var(--color-scrim) / <alpha-value>)',
        'text-hi': 'rgb(var(--color-text-hi) / <alpha-value>)',
        'text-mid': 'rgb(var(--color-text-mid) / <alpha-value>)',
        'text-low': 'rgb(var(--color-text-low) / <alpha-value>)',
        'text-inverse': 'rgb(var(--color-text-inverse) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-hover': 'rgb(var(--color-brand-hover) / <alpha-value>)',
        running: 'rgb(var(--color-running) / <alpha-value>)',
        blocked: 'rgb(var(--color-blocked) / <alpha-value>)',
        finished: 'rgb(var(--color-finished) / <alpha-value>)',
        failed: 'rgb(var(--color-failed) / <alpha-value>)',
        sleeping: 'rgb(var(--color-sleeping) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
        link: 'rgb(var(--color-link) / <alpha-value>)',
        merged: 'rgb(var(--color-merged) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'tint-primary': 'rgb(var(--color-tint-primary) / <alpha-value>)',
        'tint-secondary': 'rgb(var(--color-tint-secondary) / <alpha-value>)',
        'tint-tertiary': 'rgb(var(--color-tint-tertiary) / <alpha-value>)',
        'tint-orange': 'rgb(var(--color-tint-orange) / <alpha-value>)',
        'tint-green': 'rgb(var(--color-tint-green) / <alpha-value>)',
        'tint-red': 'rgb(var(--color-tint-red) / <alpha-value>)',
        'tint-purple': 'rgb(var(--color-tint-purple) / <alpha-value>)',
        'tint-blue': 'rgb(var(--color-tint-blue) / <alpha-value>)',
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
