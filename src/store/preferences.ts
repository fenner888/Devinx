/** Persisted UI preferences. Credentials and connection state live in /src/auth. */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PollingMode = 'battery_saver' | 'balanced' | 'fast';

const MAX_AUTO_APPROVE_SESSIONS = 200;

function isPollingMode(value: unknown): value is PollingMode {
  return value === 'battery_saver' || value === 'balanced' || value === 'fast';
}

function validAutoApproveSessions(value: unknown): Record<string, true> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, enabled]) => key.length > 0 && enabled === true)
      .slice(-MAX_AUTO_APPROVE_SESSIONS),
  );
}

interface AppPreferencesState {
  hapticsEnabled: boolean;
  pollingMode: PollingMode;
  autoApproveSessions: Record<string, true>;
  hasHydrated: boolean;
  setHaptics: (enabled: boolean) => void;
  setPollingMode: (mode: PollingMode) => void;
  setAutoApproveSession: (bridgeId: string, sessionId: string, enabled: boolean) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      pollingMode: 'balanced',
      autoApproveSessions: {},
      hasHydrated: false,
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setPollingMode: (pollingMode) => set({ pollingMode }),
      setAutoApproveSession: (bridgeId, sessionId, enabled) =>
        set((state) => {
          const key = `${bridgeId}:${sessionId}`;
          const entries = Object.entries(state.autoApproveSessions).filter(
            ([storedKey]) => storedKey !== key,
          );
          if (enabled) entries.push([key, true]);
          return {
            autoApproveSessions: Object.fromEntries(entries.slice(-MAX_AUTO_APPROVE_SESSIONS)),
          };
        }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'devinx-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persistedState) => {
        const persisted =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Record<string, unknown>)
            : {};
        return {
          hapticsEnabled:
            typeof persisted.hapticsEnabled === 'boolean' ? persisted.hapticsEnabled : true,
          pollingMode: isPollingMode(persisted.pollingMode) ? persisted.pollingMode : 'balanced',
          autoApproveSessions: validAutoApproveSessions(persisted.autoApproveSessions),
          hasHydrated: false,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Record<string, unknown>)
            : {};
        return {
          ...currentState,
          hapticsEnabled:
            typeof persisted.hapticsEnabled === 'boolean'
              ? persisted.hapticsEnabled
              : currentState.hapticsEnabled,
          pollingMode: isPollingMode(persisted.pollingMode)
            ? persisted.pollingMode
            : currentState.pollingMode,
          autoApproveSessions: validAutoApproveSessions(persisted.autoApproveSessions),
        };
      },
      partialize: (state) => ({
        hapticsEnabled: state.hapticsEnabled,
        pollingMode: state.pollingMode,
        autoApproveSessions: state.autoApproveSessions,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
