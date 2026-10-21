/** Persisted UI preferences. Credentials and connection state live in /src/auth. */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppPreferencesState {
  hapticsEnabled: boolean;
  hasHydrated: boolean;
  setHaptics: (enabled: boolean) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      hasHydrated: false,
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'devinx-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (persistedState) => ({
        hapticsEnabled:
          (persistedState as { hapticsEnabled?: boolean } | undefined)?.hapticsEnabled ?? true,
        hasHydrated: false,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        hapticsEnabled:
          (persistedState as { hapticsEnabled?: boolean } | undefined)?.hapticsEnabled ??
          currentState.hapticsEnabled,
      }),
      partialize: (state) => ({ hapticsEnabled: state.hapticsEnabled }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
