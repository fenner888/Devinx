/**
 * Zustand store — UI prefs only (spec §9). NON-sensitive.
 * Sensitive values (API key, org ID, attribution user ID) live in Keychain
 * via /src/auth, NEVER here.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PollingMode = 'battery_saver' | 'balanced' | 'fast';
export type ThemePref = 'system' | 'dark' | 'light';

interface ComposerTemplate {
  id: string;
  name: string;
  prompt: string; // prompts only — NEVER secret values (spec §9)
  tags?: string[];
  playbookId?: string;
}

interface AppPreferencesState {
  theme: ThemePref;
  pollingMode: PollingMode;
  hapticsEnabled: boolean;
  analyticsOptIn: boolean;
  defaultTags: string[];
  pinnedSessionIds: string[];
  watchedSessionIds: string[];
  composerTemplates: ComposerTemplate[];
  setTheme: (t: ThemePref) => void;
  setPollingMode: (m: PollingMode) => void;
  setHaptics: (v: boolean) => void;
  setAnalyticsOptIn: (v: boolean) => void;
  setDefaultTags: (tags: string[]) => void;
  togglePin: (id: string) => void;
  toggleWatch: (id: string) => void;
  addTemplate: (t: ComposerTemplate) => void;
  removeTemplate: (id: string) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      pollingMode: 'balanced',
      hapticsEnabled: true,
      analyticsOptIn: false, // default OFF (spec §7.7)
      defaultTags: [],
      pinnedSessionIds: [],
      watchedSessionIds: [],
      composerTemplates: [],
      setTheme: (theme) => set({ theme }),
      setPollingMode: (pollingMode) => set({ pollingMode }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setAnalyticsOptIn: (analyticsOptIn) => set({ analyticsOptIn }),
      setDefaultTags: (defaultTags) => set({ defaultTags }),
      togglePin: (id) =>
        set((s) => ({
          pinnedSessionIds: s.pinnedSessionIds.includes(id)
            ? s.pinnedSessionIds.filter((x) => x !== id)
            : [...s.pinnedSessionIds, id],
        })),
      toggleWatch: (id) =>
        set((s) => ({
          watchedSessionIds: s.watchedSessionIds.includes(id)
            ? s.watchedSessionIds.filter((x) => x !== id)
            : [...s.watchedSessionIds, id],
        })),
      addTemplate: (t) => set((s) => ({ composerTemplates: [...s.composerTemplates, t] })),
      removeTemplate: (id) =>
        set((s) => ({ composerTemplates: s.composerTemplates.filter((t) => t.id !== id) })),
    }),
    {
      name: 'devinx-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
