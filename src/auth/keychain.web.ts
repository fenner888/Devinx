/**
 * Keychain — web stub.
 * expo-secure-store is not available on web. The web target therefore keeps
 * credentials in process memory only; refresh closes the authenticated
 * preview session. Auth tokens are never written to localStorage.
 */

import { branding } from '@lib/branding';

const memoryStore = new Map<string, string>();

export async function storeSecret(key: string, value: string): Promise<void> {
  memoryStore.set(key, value);
}

export async function getSecret(key: string): Promise<string | null> {
  return memoryStore.get(key) ?? null;
}

export async function deleteSecret(key: string): Promise<void> {
  memoryStore.delete(key);
}

export async function wipeCloudSecrets(): Promise<void> {
  for (const key of [
    branding.keychain.apiKey,
    branding.keychain.orgId,
    branding.keychain.attributionUserId,
    branding.keychain.authKind,
  ]) {
    memoryStore.delete(key);
  }
}

export async function wipeAllSecrets(): Promise<void> {
  const keys = Object.values(branding.keychain);
  for (const k of keys) {
    memoryStore.delete(k);
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
