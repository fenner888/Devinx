/**
 * useSessions — TanStack Query hook for the session list (spec §7.2, §8.4).
 * Polls per the polling policy; invalidates on focus; uses stale-while-render.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@auth/AuthContext';
import { listSessions } from './endpoints';
import { queryKeys } from './queryKeys';
import { pollingPolicy, type ScreenContext } from '@lib/polling';
import { AppState } from 'react-native';

export function useSessions(screen: ScreenContext = 'board') {
  const { provider, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      const result = await listSessions(provider, { first: 100 });
      return result.items;
    },
    enabled: isAuthenticated && !!provider,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      // If any session is running, poll at the screen-appropriate rate.
      const anyRunning = data?.some((s) => s.status === 'running' || s.status === 'new' || s.status === 'claimed');
      const appState = AppState.currentState;
      if (anyRunning) {
        return pollingPolicy('running', appState === 'active' ? 'active' : 'background', screen);
      }
      // No active sessions — poll slower (board refresh every 60s).
      return appState === 'active' ? 60_000 : false;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // 401 → hard stop (spec §8.4).
      if (error instanceof Error && /401|auth/i.test(error.message)) return false;
      return failureCount < 3;
    },
  });
}
