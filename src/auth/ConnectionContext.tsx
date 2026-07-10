import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  connectionModeUsesCloud,
  isConnectionModeConfigured,
  type ConnectionMode,
} from '@lib/connections';
import { useAppPreferences } from '@store/preferences';

import { useAuth } from './AuthContext';
import {
  clearPairedComputers,
  loadPairedComputerSummaries,
  type PairedComputerSummary,
} from './pairedComputers';

interface ConnectionContextValue {
  mode: ConnectionMode;
  isLoading: boolean;
  isConfigured: boolean;
  hasCloudConnection: boolean;
  hasComputerConnection: boolean;
  usesCloud: boolean;
  computers: PairedComputerSummary[];
  connectionError: string | null;
  refreshComputers: () => Promise<void>;
  disconnectAll: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { hasCloudCredentials, isLoading: isAuthLoading, disconnect } = useAuth();
  const mode = useAppPreferences((state) => state.connectionMode);
  const hasHydrated = useAppPreferences((state) => state.hasHydrated);
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);
  const [computers, setComputers] = useState<PairedComputerSummary[]>([]);
  const [isComputerLoading, setIsComputerLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const refreshComputers = useCallback(async () => {
    setIsComputerLoading(true);
    try {
      setComputers(await loadPairedComputerSummaries());
      setConnectionError(null);
    } catch {
      setComputers([]);
      setConnectionError('Paired computer credentials could not be validated.');
    } finally {
      setIsComputerLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshComputers().catch(() => {});
  }, [refreshComputers]);

  const disconnectAll = useCallback(async () => {
    const [cloudResult, computerResult] = await Promise.allSettled([
      disconnect(),
      clearPairedComputers(),
    ]);
    if (computerResult.status === 'fulfilled') setComputers([]);
    if (cloudResult.status === 'fulfilled' && computerResult.status === 'fulfilled') {
      setConnectionMode('cloud');
      setConnectionError(null);
      return;
    }
    throw new Error('Secure connection wipe did not complete');
  }, [disconnect, setConnectionMode]);

  const value = useMemo<ConnectionContextValue>(() => {
    const hasComputerConnection = computers.length > 0;
    return {
      mode,
      isLoading: isAuthLoading || isComputerLoading || !hasHydrated,
      isConfigured: isConnectionModeConfigured(
        mode,
        hasCloudCredentials,
        hasComputerConnection,
      ),
      hasCloudConnection: hasCloudCredentials,
      hasComputerConnection,
      usesCloud: connectionModeUsesCloud(mode),
      computers,
      connectionError,
      refreshComputers,
      disconnectAll,
    };
  }, [
    mode,
    isAuthLoading,
    isComputerLoading,
    hasHydrated,
    hasCloudCredentials,
    computers,
    connectionError,
    refreshComputers,
    disconnectAll,
  ]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnections(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnections must be used within ConnectionProvider');
  return context;
}
