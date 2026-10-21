jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
});

import { useAppPreferences } from '../../src/store/preferences';

describe('preferences', () => {
  it('preserves UI haptics settings', () => {
    useAppPreferences.getState().setHaptics(false);
    expect(useAppPreferences.getState().hapticsEnabled).toBe(false);
  });

  it('restores a valid refresh speed while ignoring obsolete connection settings', async () => {
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage') as {
      setItem: (key: string, value: string) => Promise<void>;
    };
    await AsyncStorage.setItem(
      'devinx-prefs',
      JSON.stringify({
        state: {
          connectionMode: 'both',
          defaultTags: ['private'],
          pollingMode: 'fast',
          hapticsEnabled: false,
        },
        version: 4,
      }),
    );

    await useAppPreferences.persist.rehydrate();

    expect(useAppPreferences.getState().hapticsEnabled).toBe(false);
    expect(useAppPreferences.getState()).not.toHaveProperty('connectionMode');
    expect(useAppPreferences.getState()).not.toHaveProperty('defaultTags');
    expect(useAppPreferences.getState().pollingMode).toBe('fast');
  });

  it('discards an invalid persisted refresh speed and bounds enabled sessions', async () => {
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage') as {
      setItem: (key: string, value: string) => Promise<void>;
    };
    await AsyncStorage.setItem(
      'devinx-prefs',
      JSON.stringify({ state: { pollingMode: 'instant' }, version: 4 }),
    );
    await useAppPreferences.persist.rehydrate();
    expect(useAppPreferences.getState().pollingMode).toBe('balanced');

    for (let index = 0; index < 205; index += 1) {
      useAppPreferences.getState().setAutoApproveSession('bridge_test', `local_${index}`, true);
    }
    expect(Object.keys(useAppPreferences.getState().autoApproveSessions)).toHaveLength(200);
    expect(useAppPreferences.getState().autoApproveSessions['bridge_test:local_0']).toBeUndefined();
  });
});
