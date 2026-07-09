/**
 * Keychain — web stub.
 * expo-secure-store is not available on web. This stub uses localStorage
 * for dev preview only. The real native implementation lives in
 * keychain.native.ts with WHEN_UNLOCKED_THIS_DEVICE_ONLY.
 *
 * WARNING: localStorage is NOT secure. This is for web dev preview only.
 * The production app runs on iOS/Android where keychain.native.ts is used.
 */

import { branding } from '@lib/branding';

const PREFIX = 'devinx_';

/**
 * Hard block in production: localStorage is plaintext and readable by any
 * XSS. The web target is a DEV PREVIEW only — a production web build must
 * not store real API keys this way. `__DEV__` is false in production bundles.
 */
function assertDevPreview(): void {
  // eslint-disable-next-line no-undef
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    throw new Error(
      'Web credential storage is disabled in production builds — the web target is a dev preview only. Use the iOS/Android app, where secrets are stored in the device Keychain.',
    );
  }
}

export async function storeSecret(key: string, value: string): Promise<void> {
  assertDevPreview();
  localStorage.setItem(PREFIX + key, value);
}

export async function getSecret(key: string): Promise<string | null> {
  return localStorage.getItem(PREFIX + key);
}

export async function deleteSecret(key: string): Promise<void> {
  localStorage.removeItem(PREFIX + key);
}

export async function wipeAllSecrets(): Promise<void> {
  const keys = Object.values(branding.keychain);
  for (const k of keys) {
    localStorage.removeItem(PREFIX + k);
  }
}

export async function hasCredentials(): Promise<boolean> {
  const apiKey = await getSecret(branding.keychain.apiKey);
  return apiKey !== null && apiKey.length > 0;
}

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
