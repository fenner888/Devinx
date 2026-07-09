/**
 * Zustand store — UI prefs only (spec §9). NON-sensitive.
 * Sensitive values (API key, org ID, attribution user ID) live in Keychain
 * via /src/auth, NEVER here.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type { PollingMode } from '@lib/polling';
import type { PollingMode } from '@lib/polling';

export function normalizeDefaultTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

interface ComposerTemplate {
  id: string;
  name: string;
  prompt: string; // prompts only — NEVER secret values (spec §9)
  tags?: string[];
  playbookId?: string;
}

interface AppPreferencesState {
  // Theme preference is owned by ThemeProvider (persisted separately) — not here.
  pollingMode: PollingMode;
  hapticsEnabled: boolean;
  defaultTags: string[];
  pinnedSessionIds: string[];
  watchedSessionIds: string[];
  composerTemplates: ComposerTemplate[];
  setPollingMode: (m: PollingMode) => void;
  setHaptics: (v: boolean) => void;
  setDefaultTags: (tags: string[]) => void;
  togglePin: (id: string) => void;
  toggleWatch: (id: string) => void;
  addTemplate: (t: ComposerTemplate) => void;
  removeTemplate: (id: string) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      pollingMode: 'balanced',
      hapticsEnabled: true,
      defaultTags: [],
      pinnedSessionIds: [],
      watchedSessionIds: [],
      composerTemplates: [],
      setPollingMode: (pollingMode) => set({ pollingMode }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
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
