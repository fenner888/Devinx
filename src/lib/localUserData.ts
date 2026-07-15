import AsyncStorage from '@react-native-async-storage/async-storage';

export const COMPOSE_DRAFT_KEY = '@devinx/compose-draft';

const USER_SCOPED_EXACT_KEYS = new Set([COMPOSE_DRAFT_KEY, 'devinx-prefs']);
const USER_SCOPED_PREFIXES = ['@devinx/session-repository/', '@devinx/session-mode/'] as const;

export function isUserScopedStorageKey(key: string): boolean {
  return (
    USER_SCOPED_EXACT_KEYS.has(key) ||
    USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

/**
 * Remove user/session-derived AsyncStorage data while preserving device UI
 * choices such as the independently stored theme preference.
 */
export async function purgeUserScopedStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const userScopedKeys = keys.filter(isUserScopedStorageKey);
  if (userScopedKeys.length > 0) {
    await AsyncStorage.multiRemove(userScopedKeys);
  }
}
