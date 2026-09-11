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
import { normalizeConnectionMode, type ConnectionMode } from '@lib/connections';
import type { DevinMode } from '@api/devin/types';

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

export interface ComposerTemplate {
  id: string;
  name: string;
  prompt: string; // prompts only — NEVER secret values (spec §9)
  tags?: string[];
  playbookId?: string;
}

export interface CloudLaunchProfile {
  id: string;
  name: string;
  target: 'cloud';
  repositoryPaths: string[];
  mode: DevinMode;
  playbookId?: string;
  knowledgeIds: string[];
  secretIds: string[]; // references only — secret values never enter this store
  tags: string[];
  maxAcuLimit?: number;
  createdAt: number;
  updatedAt: number;
}

const DEVIN_MODES = new Set<DevinMode>(['normal', 'fast', 'lite', 'ultra', 'fusion']);
const MAX_LAUNCH_PROFILES = 20;

function normalizedStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, limit);
}

/** Fail-closed normalization for non-sensitive persisted launch defaults. */
export function normalizeLaunchProfiles(value: unknown): CloudLaunchProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: CloudLaunchProfile[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim().slice(0, 100) : '';
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : '';
    if (!id || !name || ids.has(id) || item.target !== 'cloud') continue;
    const mode = DEVIN_MODES.has(item.mode as DevinMode) ? (item.mode as DevinMode) : 'normal';
    const maxAcuLimit =
      typeof item.maxAcuLimit === 'number' &&
      Number.isFinite(item.maxAcuLimit) &&
      Number.isInteger(item.maxAcuLimit) &&
      item.maxAcuLimit > 0
        ? Math.min(item.maxAcuLimit, 10_000)
        : undefined;
    const createdAt =
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && item.createdAt > 0
        ? item.createdAt
        : Date.now();
    const updatedAt =
      typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) && item.updatedAt > 0
        ? item.updatedAt
        : createdAt;
    profiles.push({
      id,
      name,
      target: 'cloud',
      repositoryPaths: normalizedStringList(item.repositoryPaths, 20),
      mode,
      playbookId:
        typeof item.playbookId === 'string' && item.playbookId.trim()
          ? item.playbookId.trim().slice(0, 200)
          : undefined,
      knowledgeIds: normalizedStringList(item.knowledgeIds, 100),
      secretIds: normalizedStringList(item.secretIds, 100),
      tags: [...new Set(normalizedStringList(item.tags, 50).map((tag) => tag.toLowerCase()))],
      maxAcuLimit,
      createdAt,
      updatedAt,
    });
    ids.add(id);
    if (profiles.length >= MAX_LAUNCH_PROFILES) break;
  }
  return profiles;
}

export function normalizeActiveLaunchProfileId(
  value: unknown,
  profiles: CloudLaunchProfile[],
): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id && profiles.some((profile) => profile.id === id) ? id : null;
}

interface AppPreferencesState {
  // Theme preference is owned by ThemeProvider (persisted separately) — not here.
  pollingMode: PollingMode;
  hapticsEnabled: boolean;
  defaultTags: string[];
  pinnedSessionIds: string[];
  watchedSessionIds: string[];
  composerTemplates: ComposerTemplate[];
  launchProfiles: CloudLaunchProfile[];
  activeLaunchProfileId: string | null;
  acknowledgedActionIds: string[];
  connectionMode: ConnectionMode;
  hasHydrated: boolean;
  setPollingMode: (m: PollingMode) => void;
  setHaptics: (v: boolean) => void;
  setDefaultTags: (tags: string[]) => void;
  togglePin: (id: string) => void;
  toggleWatch: (id: string) => void;
  addTemplate: (t: ComposerTemplate) => void;
  removeTemplate: (id: string) => void;
  upsertLaunchProfile: (profile: CloudLaunchProfile) => void;
  removeLaunchProfile: (id: string) => void;
  setActiveLaunchProfile: (id: string | null) => void;
  acknowledgeAction: (id: string) => void;
  clearAcknowledgedAction: (id: string) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setHasHydrated: (value: boolean) => void;
  resetUserScopedData: () => void;
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
      launchProfiles: [],
      activeLaunchProfileId: null,
      acknowledgedActionIds: [],
      connectionMode: 'cloud',
      hasHydrated: false,
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
      upsertLaunchProfile: (profile) =>
        set((state) => {
          const normalized = normalizeLaunchProfiles([
            profile,
            ...state.launchProfiles.filter((item) => item.id !== profile.id),
          ]);
          return { launchProfiles: normalized };
        }),
      removeLaunchProfile: (id) =>
        set((state) => ({
          launchProfiles: state.launchProfiles.filter((profile) => profile.id !== id),
          activeLaunchProfileId:
            state.activeLaunchProfileId === id ? null : state.activeLaunchProfileId,
        })),
      setActiveLaunchProfile: (activeLaunchProfileId) =>
        set((state) => ({
          activeLaunchProfileId: normalizeActiveLaunchProfileId(
            activeLaunchProfileId,
            state.launchProfiles,
          ),
        })),
      acknowledgeAction: (id) =>
        set((state) => ({
          acknowledgedActionIds: [
            id,
            ...state.acknowledgedActionIds.filter((item) => item !== id),
          ].slice(0, 500),
        })),
      clearAcknowledgedAction: (id) =>
        set((state) => ({
          acknowledgedActionIds: state.acknowledgedActionIds.filter((item) => item !== id),
        })),
      setConnectionMode: (connectionMode) => set({ connectionMode }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      resetUserScopedData: () =>
        set({
          defaultTags: [],
          pinnedSessionIds: [],
          watchedSessionIds: [],
          composerTemplates: [],
          launchProfiles: [],
          activeLaunchProfileId: null,
          acknowledgedActionIds: [],
          connectionMode: 'cloud',
        }),
    }),
    {
      name: 'devinx-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<AppPreferencesState>;
        const launchProfiles = normalizeLaunchProfiles(state.launchProfiles);
        return {
          ...state,
          connectionMode: normalizeConnectionMode(state.connectionMode),
          launchProfiles,
          activeLaunchProfileId: normalizeActiveLaunchProfileId(
            state.activeLaunchProfileId,
            launchProfiles,
          ),
          acknowledgedActionIds: normalizedStringList(state.acknowledgedActionIds, 500),
          hasHydrated: false,
        } as AppPreferencesState;
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppPreferencesState>;
        const launchProfiles = normalizeLaunchProfiles(persisted.launchProfiles);
        return {
          ...currentState,
          ...persisted,
          connectionMode: normalizeConnectionMode(persisted.connectionMode),
          launchProfiles,
          activeLaunchProfileId: normalizeActiveLaunchProfileId(
            persisted.activeLaunchProfileId,
            launchProfiles,
          ),
          acknowledgedActionIds: normalizedStringList(persisted.acknowledgedActionIds, 500),
          hasHydrated: currentState.hasHydrated,
        };
      },
      partialize: (state) => ({
        pollingMode: state.pollingMode,
        hapticsEnabled: state.hapticsEnabled,
        defaultTags: state.defaultTags,
        pinnedSessionIds: state.pinnedSessionIds,
        watchedSessionIds: state.watchedSessionIds,
        composerTemplates: state.composerTemplates,
        launchProfiles: state.launchProfiles,
        activeLaunchProfileId: state.activeLaunchProfileId,
        acknowledgedActionIds: state.acknowledgedActionIds,
        connectionMode: state.connectionMode,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
