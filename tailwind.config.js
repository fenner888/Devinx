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
        canvas: 'rgb(var(--color-canvas))',
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
        'text-always-white': 'rgb(var(--color-text-always-white))',
        'text-always-black': 'rgb(var(--color-text-always-black))',
        'text-hi-strong': 'rgb(var(--color-text-hi-strong))',
        'brand-text': 'rgb(var(--color-brand-text))',
      },
      spacing: {
        // Component paddings from spec §1.7 (extracted from app.devin.ai)
        buttonPrimaryX: '16px', // primary button px-4
        buttonPrimaryY: '8px', // primary button py-2
        buttonSecondaryX: '8px', // secondary/ghost button px
        pillX: '10px', // status pill px
        pillY: '4px', // status pill py
      },
      borderRadius: {
        // Softer, roomier scale (Perplexity/Cursor-style) — larger surfaces.
        card: '18px',
        cardLg: '24px',
        input: '14px',
        button: '12px',
        tab: '10px',
        chip: '9999px',
        dot: '9999px',
        inlineCode: '4px',
        sheet: '24px',
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
        text11: ['11px', { lineHeight: '14px' }],
        text12: ['12px', { lineHeight: '16px' }],
        text13: ['13px', { lineHeight: '18px' }],
        text14: ['14px', { lineHeight: '20px' }],
        text16: ['16px', { lineHeight: '22px' }],
        text17: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        // Larger display sizes for the roomier hero/heading hierarchy.
        text20: ['20px', { lineHeight: '26px', fontWeight: '600' }],
        text24: ['24px', { lineHeight: '30px', fontWeight: '600' }],
        text28: ['28px', { lineHeight: '34px', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
