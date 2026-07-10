/**
 * Auth context — React hook that exposes the active AuthProvider and auth state.
 * Components/hooks import from here; this is the single auth facade.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { ServiceUserAuth, connectServiceUser, disconnect as disconnectService, refreshCache, clearCache } from './ServiceUserAuth';
import { PatAuth, connectPat, disconnectPat, isPatEnabled } from './PatAuth';
import { loadCredentials } from './keychain';
import type { AuthProvider, ValidationResult } from './AuthProvider';
import { branding } from '@lib/branding';
import { shouldEnableCloudRequests } from '@lib/connections';
import { useAppPreferences } from '@store/preferences';

interface AuthContextValue {
  provider: AuthProvider | null;
  /** Cloud credentials exist in Keychain, whether or not the selected mode uses them. */
  hasCloudCredentials: boolean;
  /** Cloud credentials exist and the selected connection mode permits Cloud requests. */
  isAuthenticated: boolean;
  /** True while the initial Keychain check is still running. */
  isLoading: boolean;
  isPatAvailable: boolean;
  connect: (params: { kind: 'service_user' | 'pat'; apiKey: string; orgId: string; attributionUserId?: string }) => Promise<ValidationResult>;
  disconnect: () => Promise<void>;
  /** Force a re-check of Keychain (e.g. on app foreground). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [hasCloudCredentials, setHasCloudCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const connectionMode = useAppPreferences((state) => state.connectionMode);
  const preferencesHydrated = useAppPreferences((state) => state.hasHydrated);
  const isAuthenticated = shouldEnableCloudRequests(
    connectionMode,
    hasCloudCredentials,
    preferencesHydrated,
  );

  useEffect(() => {
    // On mount, check if credentials exist and prime the provider.
    (async () => {
      try {
        const creds = await loadCredentials();
        if (creds) {
          const p = creds.authKind === 'pat' ? new PatAuth() : new ServiceUserAuth();
          setProvider(p);
          setHasCloudCredentials(true);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const connect = useCallback(
    async (params: { kind: 'service_user' | 'pat'; apiKey: string; orgId: string; attributionUserId?: string }): Promise<ValidationResult> => {
      const p = params.kind === 'pat' ? new PatAuth() : new ServiceUserAuth();
      // Store credentials first so validate() can read them.
      if (params.kind === 'pat') {
        await connectPat({ token: params.apiKey, orgId: params.orgId });
      } else {
        await connectServiceUser({ apiKey: params.apiKey, orgId: params.orgId, attributionUserId: params.attributionUserId });
      }
      const result = await p.validate();
      if (result.ok) {
        setProvider(p);
        setHasCloudCredentials(true);
      } else {
        // Validation failed — wipe the partial credentials.
        if (params.kind === 'pat') await disconnectPat();
        else await disconnectService();
      }
      return result;
    },
    [],
  );

  const disconnect = useCallback(async () => {
    // Wipe Keychain and zeroize BOTH providers' in-memory caches — an
    // in-flight query may still hold the other provider's instance.
    await disconnectService();
    await disconnectPat();
    setProvider(null);
    setHasCloudCredentials(false);
  }, []);

  const refresh = useCallback(async () => {
    const ok = await refreshCache();
    if (ok && !provider) {
      const creds = await loadCredentials();
      if (creds) {
        setProvider(creds.authKind === 'pat' ? new PatAuth() : new ServiceUserAuth());
        setHasCloudCredentials(true);
      }
    } else if (!ok) {
      clearCache();
      setProvider(null);
      setHasCloudCredentials(false);
    }
  }, [provider]);

  return (
    <AuthContext.Provider
      value={{
        provider,
        hasCloudCredentials,
        isAuthenticated,
        isLoading,
        isPatAvailable: isPatEnabled(),
        connect,
        disconnect,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { branding };
