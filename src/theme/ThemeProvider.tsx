/**
 * ThemeProvider — injects the extracted Devin tokens as CSS custom properties
 * so NativeWind's `rgb(var(--color-*))` classes resolve to the active theme.
 * Default theme: dark (spec §5.1). Follows system preference unless overridden.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { Appearance, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, defaultTheme, type ThemeName, type ThemeTokens } from './tokens';

type Listener = () => void;
const listeners = new Set<Listener>();
let current: ThemeName = defaultTheme;
let override: ThemeName | null = null;

export type ThemePreference = 'system' | 'dark' | 'light';
const THEME_PREF_KEY = '@devinx/theme-pref';
let themePref: ThemePreference = 'system';

/** Load saved theme preference on app start. */
export async function loadThemePreference(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      themePref = saved;
      if (saved !== 'system') {
        override = saved;
        emit();
      }
    }
  } catch { /* ignore */ }
}

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

/** Set and persist theme preference (system/dark/light). */
export async function setThemePreference(pref: ThemePreference): Promise<void> {
  themePref = pref;
  try { await AsyncStorage.setItem(THEME_PREF_KEY, pref); } catch { /* ignore */ }
  if (pref === 'system') {
    override = null;
    current = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  } else {
    override = pref;
  }
  emit();
}

/** Get current theme preference. */
export function getThemePreference(): ThemePreference {
  return themePref;
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
  const { tokens } = useTheme();
  useEffect(() => () => appearanceSubscription.remove(), []);
  const styleVars = tokensToStyleVars(tokens);
  return (
    <View style={{ flex: 1, ...styleVars } as Record<string, string | number>}>
      {children}
    </View>
  );
}
