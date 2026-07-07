/**
 * Keychain access — the ONLY module that imports expo-secure-store (spec §8.1, §10.1).
 * Stores: devin_api_key, devin_org_id, attribution_user_id, auth_kind.
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

/**
 * Wipe ALL keychain entries for DevinX (spec §10.5).
 * Called on disconnect. The §10.5 gate test asserts this leaves nothing.
 */
export async function wipeAllSecrets(): Promise<void> {
  const keys = Object.values(branding.keychain);
  await Promise.all(keys.map((k) => deleteSecret(k).catch(() => {})));
}

/**
 * Check if any credentials are stored (used to decide onboarding vs main).
 */
export async function hasCredentials(): Promise<boolean> {
  const apiKey = await getSecret(branding.keychain.apiKey);
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Load all credentials at once (lazy, called on app foreground).
 * Returns null if not authenticated.
 */
export interface StoredCredentials {
  apiKey: string;
  orgId: string;
  attributionUserId: string | null;
  authKind: 'service_user' | 'pat';
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const [apiKey, orgId, attributionUserId, authKind] = await Promise.all([
    getSecret(branding.keychain.apiKey),
    getSecret(branding.keychain.orgId),
    getSecret(branding.keychain.attributionUserId),
    getSecret(branding.keychain.authKind),
  ]);
  if (!apiKey) return null;
  return {
    apiKey,
    orgId: orgId ?? '',
    attributionUserId: attributionUserId ?? null,
    authKind: (authKind as 'service_user' | 'pat') ?? 'service_user',
  };
}
