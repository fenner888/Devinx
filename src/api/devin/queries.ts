/**
 * TanStack Query hooks — useSessions, useSession, useMessages (spec §7.2, §7.3, §8.4).
 * Polling per the polling policy; 401 hard-stop; stale-while-render.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useAuth } from '@auth/AuthContext';
import { listSessions, getSession, listMessages, sendMessage } from './endpoints';
import { queryKeys } from './queryKeys';
import { pollingPolicy, type ScreenContext } from '@lib/polling';

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
      const anyRunning = data?.some((s) => s.status === 'running' || s.status === 'new' || s.status === 'claimed');
      const appState = AppState.currentState;
      if (anyRunning) {
        return pollingPolicy('running', appState === 'active' ? 'active' : 'background', screen);
      }
      return appState === 'active' ? 60_000 : false;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && /401|auth/i.test(error.message)) return false;
      return failureCount < 3;
    },
  });
}

export function useSession(sessionId: string | undefined) {
  const { provider, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: sessionId ? queryKeys.session(sessionId) : ['session', 'none'],
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      if (!sessionId) throw new Error('No session ID');
      return getSession(provider, sessionId);
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5_000;
      // Poll faster while session is active.
      const isActive = data.status === 'running' || data.status === 'new' || data.status === 'claimed';
      const appState = AppState.currentState;
      if (isActive) {
        return pollingPolicy('running', appState === 'active' ? 'active' : 'background', 'session_detail');
      }
      // Session finished — stop polling.
      return false;
    },
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && /401|auth/i.test(error.message)) return false;
      return failureCount < 3;
    },
  });
}

export function useMessages(sessionId: string | undefined) {
  const { provider, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: sessionId ? queryKeys.messages(sessionId) : ['messages', 'none'],
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      if (!sessionId) throw new Error('No session ID');
      const result = await listMessages(provider, sessionId, { first: 100 });
      return result.items;
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: () => {
      const appState = AppState.currentState;
      // Poll messages while session is likely active (we don't have session status here,
      // but the session detail screen will invalidate this when the session finishes).
      if (appState === 'active') return 5_000;
      return false;
    },
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof Error && /401|auth/i.test(error.message)) return false;
      return failureCount < 3;
    },
  });
}

export function useSendMessage(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { provider } = useAuth();

  return useMutation({
    mutationFn: async (params: { message: string; attachmentUrls?: string[] }) => {
      if (!provider) throw new Error('Not authenticated');
      if (!sessionId) throw new Error('No session ID');
      await sendMessage(provider, sessionId, params.message, params.attachmentUrls);
    },
    onSuccess: () => {
      // Invalidate messages so they refetch with the new message.
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(sessionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      }
    },
  });
}
