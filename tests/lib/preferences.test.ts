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

  it('ignores obsolete Cloud and connection settings in persisted state', async () => {
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
        version: 3,
      }),
    );

    await useAppPreferences.persist.rehydrate();

    expect(useAppPreferences.getState().hapticsEnabled).toBe(false);
    expect(useAppPreferences.getState()).not.toHaveProperty('connectionMode');
    expect(useAppPreferences.getState()).not.toHaveProperty('defaultTags');
    expect(useAppPreferences.getState()).not.toHaveProperty('pollingMode');
  });
});
