/**
 * In-memory handoff of credentials between onboarding screens (spec §10.1).
 * Secrets must NEVER travel through router params — Expo Router serializes
 * params into the URL, so on web the key would land in the address bar,
 * browser history, and session-restore storage.
 */

export interface PendingCredentials {
  kind: 'service_user' | 'pat';
  apiKey: string;
  orgId: string;
  attributionUserId?: string;
}

let pending: PendingCredentials | null = null;

export function setPendingCredentials(creds: PendingCredentials): void {
  pending = creds;
}

/** Read and clear — single use so the secret doesn't linger in memory. */
export function takePendingCredentials(): PendingCredentials | null {
  const p = pending;
  pending = null;
  return p;
}
