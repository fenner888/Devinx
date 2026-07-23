/**
 * PatAuth — Personal Access Token strategy (spec §8.2, ADR-004).
 * Flag-gated behind EXPO_PUBLIC_ENABLE_PAT until PAT GA.
 *
 * PATs authenticate directly as the user with automatic attribution.
 * No org ID needed (the token implies the org); no create_as_user_id needed.
 */

import { captureDiagnostic } from '@lib/diagnostics';
import { branding } from '@lib/branding';
import { storeSecret, loadCredentials, wipeCloudSecrets, type StoredCredentials } from './keychain';
import type { AuthProvider, ValidationResult } from './AuthProvider';

let cached: StoredCredentials | null = null;

export function isPatEnabled(): boolean {
  // PATs remain a closed-beta authentication path. Existing stored PATs can
  // still be loaded, but presenting a new PAT connection requires an explicit
  // release-time opt-in.
  return process.env.EXPO_PUBLIC_ENABLE_PAT === 'true';
}

export async function connectPat(params: { token: string; orgId: string }): Promise<void> {
  const { token, orgId } = params;
  await storeSecret(branding.keychain.apiKey, token);
  await storeSecret(branding.keychain.orgId, orgId);
  await storeSecret(branding.keychain.authKind, 'pat');
  cached = { apiKey: token, orgId, attributionUserId: null, authKind: 'pat' };
}

export class PatAuth implements AuthProvider {
  readonly kind = 'pat' as const;

  private async getCreds(): Promise<StoredCredentials> {
    if (cached) return cached;
    const loaded = await loadCredentials();
    if (!loaded) throw new Error('Not authenticated — no PAT in Keychain');
    cached = loaded;
    return cached;
  }

  async authHeaders(): Promise<Record<string, string>> {
    const { apiKey } = await this.getCreds();
    return { Authorization: `Bearer ${apiKey}` };
  }

  async orgPath(): Promise<string> {
    const { orgId } = await this.getCreds();
    return `/v3/organizations/${orgId}`;
  }

  async sessionAttribution(): Promise<{ create_as_user_id?: string }> {
    // PATs auto-attribute — no create_as_user_id needed.
    return {};
  }

  async credentialFingerprint(): Promise<string> {
    const { apiKey } = await this.getCreds();
    return apiKey.slice(-4);
  }

  async validate(): Promise<ValidationResult> {
    try {
      const headers = await this.authHeaders();
      const orgPath = await this.orgPath();
      const url = `https://api.devin.ai${orgPath}/sessions?first=1`;
      const res = await fetch(url, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true };
      if (res.status === 401)
        return { ok: false, code: 'invalid_key', detail: 'Invalid personal access token.' };
      if (res.status === 403)
        return {
          ok: false,
          code: 'missing_permission',
          detail: 'This token lacks session permissions.',
        };
      return { ok: false, code: 'network', detail: `Unexpected: ${res.status}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/timeout|abort|network/i.test(msg)) {
        return { ok: false, code: 'network', detail: 'Could not reach api.devin.ai.' };
      }
      captureDiagnostic(e);
      return { ok: false, code: 'network', detail: msg };
    }
  }
}

export async function disconnectPat(): Promise<void> {
  cached = null;
  await wipeCloudSecrets();
}
