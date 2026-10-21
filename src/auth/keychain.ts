/**
 * Keychain access — the ONLY module that imports expo-secure-store (spec §8.1, §10.1).
 * Stores the encrypted-at-rest paired-computer registry and removes legacy Cloud credentials.
 * Accessibility: WHEN_UNLOCKED_THIS_DEVICE_ONLY (spec §10.1) — not in iCloud/backup.
 */

import * as SecureStore from 'expo-secure-store';
import { branding } from '@lib/branding';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export async function storeSecret(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function getSecret(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function deleteSecret(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function wipeLegacyCloudCredentials(): Promise<void> {
  const keys = [
    branding.keychain.apiKey,
    branding.keychain.orgId,
    branding.keychain.attributionUserId,
    branding.keychain.authKind,
  ];
  await Promise.all(keys.map((key) => deleteSecret(key)));
}
