/** Secure-store web stub for Local pairing state. */

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

export async function wipeLegacyCloudCredentials(): Promise<void> {
  await Promise.all(
    [
    branding.keychain.apiKey,
    branding.keychain.orgId,
    branding.keychain.attributionUserId,
    branding.keychain.authKind,
    ].map((key) => deleteSecret(key)),
  );
}
