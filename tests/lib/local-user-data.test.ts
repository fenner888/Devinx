import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COMPOSE_DRAFT_KEY,
  isUserScopedStorageKey,
  purgeUserScopedStorage,
} from '../../src/lib/localUserData';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('local user data wipe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies only user and session-derived keys', () => {
    expect(isUserScopedStorageKey(COMPOSE_DRAFT_KEY)).toBe(true);
    expect(isUserScopedStorageKey('devinx-prefs')).toBe(true);
    expect(isUserScopedStorageKey('@devinx/session-repository/session-1')).toBe(true);
    expect(isUserScopedStorageKey('@devinx/session-mode/session-1')).toBe(true);
    expect(isUserScopedStorageKey('@devinx/theme-pref')).toBe(false);
    expect(isUserScopedStorageKey('@another-app/value')).toBe(false);
  });

  it('removes drafts, preferences, and remembered session context only', async () => {
    storage.getAllKeys.mockResolvedValue([
      COMPOSE_DRAFT_KEY,
      'devinx-prefs',
      '@devinx/session-repository/session-1',
      '@devinx/session-mode/session-1',
      '@devinx/theme-pref',
      '@another-app/value',
    ]);

    await purgeUserScopedStorage();

    expect(storage.multiRemove).toHaveBeenCalledWith([
      COMPOSE_DRAFT_KEY,
      'devinx-prefs',
      '@devinx/session-repository/session-1',
      '@devinx/session-mode/session-1',
    ]);
  });

  it('does not issue an empty removal', async () => {
    storage.getAllKeys.mockResolvedValue(['@devinx/theme-pref']);

    await purgeUserScopedStorage();

    expect(storage.multiRemove).not.toHaveBeenCalled();
  });
});
