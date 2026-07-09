/**
 * TanStack Query hooks — useSessions, useSession, useMessages (spec §7.2, §7.3, §8.4).
 * Polling per the polling policy; 401 hard-stop; stale-while-render.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useAuth } from '@auth/AuthContext';
import { shouldRetryQuery } from './client';
import { listSessions, getSession, listMessages, sendMessage, createSession, listPlaybooks, listKnowledge, listSecrets, archiveSession, terminateSession, getDailyConsumption, getInsights, generateInsights, replaceTags, uploadAttachment, listSchedules, createSchedule, updateSchedule, deleteSchedule, triggerPrReview, getPrReview, listCodeScanFindings, remediateFinding, createKnowledgeNote, updateKnowledgeNote, deleteKnowledgeNote, createPlaybook, updatePlaybook, deletePlaybook, createSecret, deleteSecret, getSessionMetrics, getPrMetrics, getSearchMetrics, getWeeklyActiveUsers, listRepositories, getSelf, getSessionConsumption, listIndexedRepositories, indexRepository } from './endpoints';
import { queryKeys } from './queryKeys';
import { pollingPolicy, scalePolling, type ScreenContext } from '@lib/polling';
import { useAppPreferences } from '@store/preferences';
import type { Cursor, SessionCreateRequest, SessionResponse, ScheduleCreateRequest, ScheduleUpdateRequest, KnowledgeNoteCreateRequest, KnowledgeNoteUpdateRequest, PlaybookCreateRequest, PlaybookUpdateRequest, SecretCreateRequest, MetricsQuery } from './types';

// Pagination caps — enough for any realistic board/timeline while bounding
// worst-case request fan-out per refetch.
const MAX_SESSION_PAGES = 5; // 500 sessions
const MAX_MESSAGE_PAGES = 10; // 1000 messages

/** Statuses in which a session can still produce updates. */
function isActiveStatus(status: SessionResponse['status'] | undefined): boolean {
  return status === 'running' || status === 'new' || status === 'claimed' || status === 'resuming';
}

export function useSessions(screen: ScreenContext = 'board') {
  const { provider, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      // Follow pagination — a single page silently capped the board at 100.
      const items: SessionResponse[] = [];
      let cursor: Cursor | null = null;
      for (let page = 0; page < MAX_SESSION_PAGES; page++) {
        const result = await listSessions(provider, { first: 100, after: cursor });
        items.push(...result.items);
        if (!result.hasNextPage || !result.endCursor) break;
        cursor = result.endCursor;
      }
      return items;
    },
    enabled: isAuthenticated && !!provider,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      const anyRunning = data?.some((s) => isActiveStatus(s.status));
      const appState = AppState.currentState;
      const mode = useAppPreferences.getState().pollingMode;
      if (anyRunning) {
        return pollingPolicy('running', appState === 'active' ? 'active' : 'background', screen, mode);
      }
      return appState === 'active' ? scalePolling(60_000, mode) : false;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: shouldRetryQuery,
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
      const isActive = isActiveStatus(data.status);
      const appState = AppState.currentState;
      if (isActive || data.status === 'suspended') {
        return pollingPolicy(data.status, appState === 'active' ? 'active' : 'background', 'session_detail', useAppPreferences.getState().pollingMode);
      }
      // Session finished — stop polling.
      return false;
    },
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
  });
}

interface MessagesData {
  items: import('./types').SessionMessage[];
  endCursor: Cursor | null;
}

export function useMessages(sessionId: string | undefined) {
  const { provider, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: sessionId ? queryKeys.messages(sessionId) : ['messages', 'none'],
    queryFn: async (): Promise<MessagesData> => {
      if (!provider) throw new Error('Not authenticated');
      if (!sessionId) throw new Error('No session ID');
      // Incremental fetch: messages are append-only with forward cursors, so
      // steady-state polls only pull NEW messages after the stored cursor
      // instead of re-downloading every page every 5 seconds.
      const prev = queryClient.getQueryData<MessagesData>(queryKeys.messages(sessionId));
      const items = prev ? [...prev.items] : [];
      let cursor: Cursor | null = prev?.endCursor ?? null;
      for (let page = 0; page < MAX_MESSAGE_PAGES; page++) {
        const result = await listMessages(provider, sessionId, { first: 100, after: cursor });
        items.push(...result.items);
        if (result.endCursor) cursor = result.endCursor;
        if (!result.hasNextPage) break;
      }
      // Dedupe by event_id in case a page boundary repeats an item.
      const seen = new Set<string>();
      const deduped = items.filter((m) => {
        if (seen.has(m.event_id)) return false;
        seen.add(m.event_id);
        return true;
      });
      return { items: deduped, endCursor: cursor };
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: () => {
      if (AppState.currentState !== 'active') return false;
      // Read the session's cached status — finished/terminated sessions get
      // no new messages, so polling them forever just burns battery and API.
      const session = sessionId
        ? queryClient.getQueryData<SessionResponse>(queryKeys.session(sessionId))
        : undefined;
      if (session && !isActiveStatus(session.status)) return false;
      // Snappier while a session is live so Devin's replies appear quickly.
      return scalePolling(2_500, useAppPreferences.getState().pollingMode);
    },
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
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
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(sessionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      }
    },
  });
}

export function usePlaybooks() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.playbooks,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listPlaybooks(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useKnowledge() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.knowledge,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listKnowledge(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();

  return useMutation({
    mutationFn: async (body: SessionCreateRequest): Promise<SessionResponse> => {
      if (!provider) throw new Error('Not authenticated');
      return createSession(provider, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useDailyConsumption(rangeDays = 30) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.consumption, rangeDays],
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      // Without an explicit range the endpoint returns nothing — request the
      // last N days so the chart actually has data (matches the screen copy).
      const now = Math.floor(Date.now() / 1000);
      return getDailyConsumption(provider, {
        time_after: now - rangeDays * 86_400,
        time_before: now,
      });
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useArchiveSession() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await archiveSession(provider, sessionId);
    },
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
    },
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await terminateSession(provider, sessionId);
    },
    onSuccess: (_data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(sessionId) });
    },
  });
}

export function useSecrets() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.secrets,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listSecrets(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useInsights(sessionId: string | undefined) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.insights(sessionId ?? ''),
    queryFn: async () => {
      if (!provider || !sessionId) throw new Error('Not authenticated');
      return getInsights(provider, sessionId);
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    staleTime: 60_000,
    retry: shouldRetryQuery,
  });
}

export function useGenerateInsights(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!provider || !sessionId) throw new Error('Not authenticated');
      return generateInsights(provider, sessionId);
    },
    onSuccess: () => {
      if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.insights(sessionId) });
    },
  });
}

export function useUploadAttachment() {
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (file: { name: string; type: string; uri: string }) => {
      if (!provider) throw new Error('Not authenticated');
      return uploadAttachment(provider, file);
    },
  });
}

export function useUpdateTags(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (tags: string[]) => {
      if (!provider || !sessionId) throw new Error('Not authenticated');
      return replaceTags(provider, sessionId, tags);
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Schedules (Automations)
// ---------------------------------------------------------------------------

export function useSchedules() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.schedules,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listSchedules(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (body: ScheduleCreateRequest) => {
      if (!provider) throw new Error('Not authenticated');
      return createSchedule(provider, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules }),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (params: { scheduleId: string; body: ScheduleUpdateRequest }) => {
      if (!provider) throw new Error('Not authenticated');
      return updateSchedule(provider, params.scheduleId, params.body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules }),
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await deleteSchedule(provider, scheduleId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules }),
  });
}

// ---------------------------------------------------------------------------
// PR Reviews (Devin Review)
// ---------------------------------------------------------------------------

export function usePrReview(prUrl: string | null) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.prReview(prUrl ?? ''),
    queryFn: async () => {
      if (!provider || !prUrl) throw new Error('Not authenticated');
      return getPrReview(provider, prUrl);
    },
    enabled: isAuthenticated && !!provider && !!prUrl,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll while a review is in flight.
      return status === 'pending' || status === 'running' ? 10_000 : false;
    },
    retry: shouldRetryQuery,
  });
}

export function useTriggerPrReview() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (prUrl: string) => {
      if (!provider) throw new Error('Not authenticated');
      return triggerPrReview(provider, prUrl);
    },
    onSuccess: (_data, prUrl) => queryClient.invalidateQueries({ queryKey: queryKeys.prReview(prUrl) }),
  });
}

// ---------------------------------------------------------------------------
// Code scans (Devin Security — enterprise-scoped)
// ---------------------------------------------------------------------------

export function useCodeScanFindings() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.codeScanFindings,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listCodeScanFindings(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    // This query doubles as the enterprise-access probe for the Security nav
    // item. For org-level keys it always 403s — without these flags the
    // failed probe refires on every home mount/focus. Pull-to-refresh on the
    // Security screen still refetches manually.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: shouldRetryQuery,
  });
}

export function useRemediateFinding() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (params: { scanId: string; findingId: string }) => {
      if (!provider) throw new Error('Not authenticated');
      await remediateFinding(provider, params.scanId, params.findingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.codeScanFindings });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// ---------------------------------------------------------------------------
// Resource management (Knowledge / Playbooks / Secrets)
// ---------------------------------------------------------------------------

export function useCreateKnowledgeNote() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (body: KnowledgeNoteCreateRequest) => {
      if (!provider) throw new Error('Not authenticated');
      return createKnowledgeNote(provider, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.knowledge }),
  });
}

export function useUpdateKnowledgeNote() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (params: { noteId: string; body: KnowledgeNoteUpdateRequest }) => {
      if (!provider) throw new Error('Not authenticated');
      return updateKnowledgeNote(provider, params.noteId, params.body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.knowledge }),
  });
}

export function useDeleteKnowledgeNote() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (noteId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await deleteKnowledgeNote(provider, noteId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.knowledge }),
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (body: PlaybookCreateRequest) => {
      if (!provider) throw new Error('Not authenticated');
      return createPlaybook(provider, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.playbooks }),
  });
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (params: { playbookId: string; body: PlaybookUpdateRequest }) => {
      if (!provider) throw new Error('Not authenticated');
      return updatePlaybook(provider, params.playbookId, params.body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.playbooks }),
  });
}

export function useDeletePlaybook() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (playbookId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await deletePlaybook(provider, playbookId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.playbooks }),
  });
}

export function useCreateSecret() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (body: SecretCreateRequest) => {
      if (!provider) throw new Error('Not authenticated');
      return createSecret(provider, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets }),
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (secretId: string) => {
      if (!provider) throw new Error('Not authenticated');
      await deleteSecret(provider, secretId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.secrets }),
  });
}

// ---------------------------------------------------------------------------
// Org metrics (Analytics)
// ---------------------------------------------------------------------------

export interface OrgMetricsBundle {
  sessions: Awaited<ReturnType<typeof getSessionMetrics>>;
  prs: Awaited<ReturnType<typeof getPrMetrics>>;
  searches: Awaited<ReturnType<typeof getSearchMetrics>>;
  weeklyActiveUsers: Awaited<ReturnType<typeof getWeeklyActiveUsers>>;
}

export function useOrgMetrics(rangeDays: number) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.metrics(String(rangeDays)),
    queryFn: async (): Promise<OrgMetricsBundle> => {
      if (!provider) throw new Error('Not authenticated');
      // Both bounds are REQUIRED by the metrics API — omitting time_before
      // returns a 422 and blanks the screen.
      const now = Math.floor(Date.now() / 1000);
      const query: MetricsQuery = {
        time_after: now - rangeDays * 86_400,
        time_before: now,
      };
      // Fire the four metric calls together; WAU/searches may be unavailable
      // on some plans — degrade those to empty rather than failing the screen.
      const [sessions, prs, searches, weeklyActiveUsers] = await Promise.all([
        getSessionMetrics(provider, query),
        getPrMetrics(provider, query).catch(() => ({}) as Awaited<ReturnType<typeof getPrMetrics>>),
        getSearchMetrics(provider, query).catch(() => ({}) as Awaited<ReturnType<typeof getSearchMetrics>>),
        getWeeklyActiveUsers(provider, query).catch(() => []),
      ]);
      return { sessions, prs, searches, weeklyActiveUsers };
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    retry: shouldRetryQuery,
  });
}

// ---------------------------------------------------------------------------
// Repositories (v3beta1)
// ---------------------------------------------------------------------------

export function useRepositories() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.repositories,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listRepositories(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 10 * 60_000,
    retry: shouldRetryQuery,
  });
}

// ---------------------------------------------------------------------------
// Self / identity
// ---------------------------------------------------------------------------

export function useSelf() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.self,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return getSelf(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 10 * 60_000,
    retry: shouldRetryQuery,
  });
}

// ---------------------------------------------------------------------------
// Per-session ACU consumption
// ---------------------------------------------------------------------------

export function useSessionConsumption(sessionId: string | undefined) {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.sessionConsumption(sessionId ?? ''),
    queryFn: async () => {
      if (!provider || !sessionId) throw new Error('Not authenticated');
      return getSessionConsumption(provider, sessionId);
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    staleTime: 60_000,
    retry: shouldRetryQuery,
  });
}

// ---------------------------------------------------------------------------
// Repository indexing (v3beta1)
// ---------------------------------------------------------------------------

export function useIndexedRepositories() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.repoIndexing,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listIndexedRepositories(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 5 * 60_000,
    retry: shouldRetryQuery,
  });
}

export function useIndexRepository() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();
  return useMutation({
    mutationFn: async (params: { repoPath: string; branches?: string[] }) => {
      if (!provider) throw new Error('Not authenticated');
      return indexRepository(provider, params.repoPath, params.branches);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.repoIndexing }),
  });
}
