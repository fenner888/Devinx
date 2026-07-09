/**
 * ServiceUserAuth — the v1 auth strategy (spec §8.2, ADR-004).
 * Uses a cog_-prefixed service-user API key + org ID.
 * Optionally attributes sessions to a human user via create_as_user_id.
 *
 * Key retrieval is lazy + memoized per app foreground; zeroized on disconnect.
 */

import * as Sentry from '@sentry/react-native';
import { branding } from '@lib/branding';
import { loadCredentials, storeSecret, wipeAllSecrets, type StoredCredentials } from './keychain';
import type { AuthProvider, ValidationResult } from './AuthProvider';

let cached: StoredCredentials | null = null;

/**
 * Persist credentials to Keychain and prime the in-memory cache.
 * Called by the onboarding Validate step on success.
 */
export async function connectServiceUser(params: {
  apiKey: string;
  orgId: string;
  attributionUserId?: string;
}): Promise<void> {
  const { apiKey, orgId, attributionUserId } = params;
  await storeSecret(branding.keychain.apiKey, apiKey);
  await storeSecret(branding.keychain.orgId, orgId);
  await storeSecret(branding.keychain.authKind, 'service_user');
  if (attributionUserId) {
    await storeSecret(branding.keychain.attributionUserId, attributionUserId);
  }
  cached = {
    apiKey,
    orgId,
    attributionUserId: attributionUserId ?? null,
    authKind: 'service_user',
  };
}

export class ServiceUserAuth implements AuthProvider {
  readonly kind = 'service_user' as const;

  private async getCreds(): Promise<StoredCredentials> {
    if (cached) return cached;
    const loaded = await loadCredentials();
    if (!loaded) {
      throw new Error('Not authenticated — no service-user credentials in Keychain');
    }
    cached = loaded;
    return loaded;
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
    const { attributionUserId } = await this.getCreds();
    return attributionUserId ? { create_as_user_id: attributionUserId } : {};
  }

  async credentialFingerprint(): Promise<string> {
    const { apiKey } = await this.getCreds();
    return apiKey.slice(-4);
  }

  /**
   * Cheap authenticated call — GET the session list with first=1.
   * Maps 401/403/network to actionable errors per spec §7.1 step 3.
   */
  async validate(): Promise<ValidationResult> {
    try {
      const headers = await this.authHeaders();
      const orgPath = await this.orgPath();
      const url = `https://api.devin.ai${orgPath}/sessions?first=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) return { ok: true };
      if (res.status === 401) {
        return {
          ok: false,
          code: 'invalid_key',
          detail: 'Invalid API key. Check that it starts with cog_ and has not been revoked.',
        };
      }
      if (res.status === 403) {
        // The Devin API returns 403 for both invalid keys and insufficient permissions.
        // Distinguish by checking the response body.
        let body = '';
        try {
          body = await res.text();
        } catch {
          /* ignore */
        }
        if (/unauthorized/i.test(body)) {
          return {
            ok: false,
            code: 'invalid_key',
            detail:
              'Invalid or unauthorized API key. Check that it starts with cog_ and has not been revoked.',
          };
        }
        return {
          ok: false,
          code: 'missing_permission',
          detail:
            'This key lacks permission to list sessions. Create a service user with Member role or higher.',
        };
      }
      if (res.status === 404) {
        return {
          ok: false,
          code: 'invalid_key',
          detail: 'Organization not found. Check your org ID (should start with org-).',
        };
      }
      return { ok: false, code: 'network', detail: `Unexpected response: ${res.status}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/timeout|abort|network/i.test(msg)) {
        return {
          ok: false,
          code: 'network',
          detail: 'Could not reach api.devin.ai. Check your connection.',
        };
      }
      Sentry.captureException(e);
      return { ok: false, code: 'network', detail: msg };
    }
  }
}

/**
 * Disconnect — wipe Keychain + zeroize cache (spec §10.5).
 * The caller also wipes SQLite cache + query cache.
 */
export async function disconnect(): Promise<void> {
  cached = null;
  await wipeAllSecrets();
}

/** Clear the in-memory cache (called on app background to minimize secret lifetime). */
export function clearCache(): void {
  cached = null;
}

/** Re-prime the cache from Keychain (called on app foreground). */
export async function refreshCache(): Promise<boolean> {
  const loaded = await loadCredentials();
  cached = loaded;
  return loaded !== null;
}
