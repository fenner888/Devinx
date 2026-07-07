/**
 * ThemeProvider — injects the extracted Devin tokens as CSS custom properties
 * so NativeWind's `rgb(var(--color-*))` classes resolve to the active theme.
 * Default theme: dark (spec §5.1). Follows system preference unless overridden.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { themes, defaultTheme, type ThemeName, type ThemeTokens } from './tokens';

type Listener = () => void;
const listeners = new Set<Listener>();
let current: ThemeName = defaultTheme;
let override: ThemeName | null = null;

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): ThemeName {
  return override ?? current;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
  if (override) return;
  current = colorScheme === 'light' ? 'light' : 'dark';
  emit();
});

export function setThemeOverride(theme: ThemeName | null) {
  override = theme;
  emit();
}

export function useTheme(): { name: ThemeName; tokens: ThemeTokens } {
  const name = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { name, tokens: themes[name] };
}

/**
 * Returns a flat `style` object of CSS-variable-style key/value pairs that
 * ThemeProvider injects via a wrapping <View style={...}>. NativeWind reads
 * these as inherited custom properties. Wired in Session 1.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tokensToStyleVars(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    out[`--color-${kebab(key)}`] = value.channels;
  }
  return out;
}

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  useEffect(() => () => appearanceSubscription.remove(), []);
  // Style vars are injected in Session 1 when NativeWind components consume them.
  // Phase 0 just tracks the active theme so useTheme() works for StatusBar etc.
  return <>{children}</>;
}
