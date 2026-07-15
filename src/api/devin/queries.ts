/**
 * TanStack Query hooks — useSessions, useSession, useMessages (spec §7.2, §7.3, §8.4).
 * Polling per the polling policy; 401 hard-stop; stale-while-render.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useAuth } from '@auth/AuthContext';
import type { AuthProvider } from '@auth/AuthProvider';
import { shouldRetryQuery, ApiError } from './client';
import { saveSessions, loadCachedSessions } from '@cache/index';
import {
  listSessions,
  getSession,
  listMessages,
  sendMessage,
  createSession,
  listPlaybooks,
  listKnowledge,
  listKnowledgeFolders,
  listSecrets,
  archiveSession,
  terminateSession,
  getDailyConsumption,
  listConsumptionCycles,
  listDevinAcuLimits,
  getInsights,
  generateInsights,
  replaceTags,
  uploadAttachment,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  triggerPrReview,
  getPrReview,
  createKnowledgeNote,
  updateKnowledgeNote,
  deleteKnowledgeNote,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  createSecret,
  deleteSecret,
  getSessionMetrics,
  getPrMetrics,
  getSearchMetrics,
  getWeeklyActiveUsers,
  listRepositories,
  getSelf,
  getSessionConsumption,
} from './endpoints';
import { queryKeys } from './queryKeys';
import {
  messagePollingInterval,
  pollingPolicy,
  scalePolling,
  type ScreenContext,
} from '@lib/polling';
import { useAppPreferences } from '@store/preferences';
import { findPotentialCreatedSession } from '@lib/session-create';
import { removeSessionFromBoard } from '@lib/session-utils';
import type {
  Cursor,
  SessionCreateRequest,
  SessionResponse,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  KnowledgeNoteCreateRequest,
  KnowledgeNoteUpdateRequest,
  PlaybookCreateRequest,
  PlaybookUpdateRequest,
  SecretCreateRequest,
  MetricsQuery,
} from './types';

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
      try {
        // Follow pagination — a single page silently capped the board at 100.
        const items: SessionResponse[] = [];
        let cursor: Cursor | null = null;
        for (let page = 0; page < MAX_SESSION_PAGES; page++) {
          const result = await listSessions(provider, {
            first: 100,
            after: cursor,
            is_archived: false,
          });
          items.push(...result.items);
          if (!result.hasNextPage || !result.endCursor) break;
          cursor = result.endCursor;
        }
        // Persist the board for offline / cold-start hydration (no secrets).
        saveSessions(
          items.map((s) => ({
            ...s,
            session_id: s.session_id,
            status: s.status,
            updated_at: s.updated_at,
          })),
        ).catch(() => {});
        return items;
      } catch (e) {
        // Offline (or transient network) — fall back to the last cached board
        // instead of an error with no data.
        if (e instanceof ApiError && e.code === 'network') {
          const cached = await loadCachedSessions<SessionResponse>();
          if (cached.length > 0) return cached;
        }
        throw e;
      }
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
        return pollingPolicy(
          'running',
          appState === 'active' ? 'active' : 'background',
          screen,
          mode,
        );
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
        return pollingPolicy(
          data.status,
          appState === 'active' ? 'active' : 'background',
          'session_detail',
          useAppPreferences.getState().pollingMode,
        );
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
      const previousDevinIds = new Set(
        prev?.items
          .filter((message) => message.source === 'devin')
          .map((message) => message.event_id),
      );
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
      if (
        prev &&
        deduped.some(
          (message) => message.source === 'devin' && !previousDevinIds.has(message.event_id),
        )
      ) {
        queryClient.removeQueries({ queryKey: queryKeys.messageFollowUp(sessionId), exact: true });
      }
      return { items: deduped, endCursor: cursor };
    },
    enabled: isAuthenticated && !!provider && !!sessionId,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: () => {
      const followUpUntil = sessionId
        ? queryClient.getQueryData<number>(queryKeys.messageFollowUp(sessionId))
        : undefined;
      const session = sessionId
        ? queryClient.getQueryData<SessionResponse>(queryKeys.session(sessionId))
        : undefined;
      return messagePollingInterval({
        appState: AppState.currentState === 'active' ? 'active' : 'background',
        followUpUntil,
        sessionStatus: session?.status,
        mode: useAppPreferences.getState().pollingMode,
      });
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
      return sendMessage(provider, sessionId, params.message, params.attachmentUrls);
    },
    onMutate: () => {
      if (sessionId) {
        queryClient.setQueryData(queryKeys.messageFollowUp(sessionId), Date.now() + 2 * 60_000);
      }
    },
    onSuccess: (session) => {
      if (sessionId) {
        queryClient.setQueryData(queryKeys.session(sessionId), session);
        queryClient.invalidateQueries({ queryKey: queryKeys.messages(sessionId) });
      }
    },
    onError: () => {
      if (sessionId) queryClient.removeQueries({ queryKey: queryKeys.messageFollowUp(sessionId) });
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

export function useKnowledgeFolders() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.knowledgeFolders,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      return listKnowledgeFolders(provider);
    },
    enabled: isAuthenticated && !!provider,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: shouldRetryQuery,
  });
}

async function reconcileAmbiguousSessionCreate(
  provider: AuthProvider,
  body: SessionCreateRequest,
  startedAt: number,
): Promise<SessionResponse | undefined> {
  const identity = await getSelf(provider).catch(() => undefined);
  if (!identity?.service_user_id && !identity?.user_id) return undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await listSessions(provider, {
        first: 100,
        created_after: startedAt - 5,
        search: body.title || undefined,
      });
      const match = findPotentialCreatedSession(body, result.items, startedAt, identity);
      if (match) return match;
    } catch {
      return undefined;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return undefined;
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { provider } = useAuth();

  return useMutation({
    mutationFn: async (body: SessionCreateRequest): Promise<SessionResponse> => {
      if (!provider) throw new Error('Not authenticated');
      const startedAt = Math.floor(Date.now() / 1000);
      try {
        return await createSession(provider, body);
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'network') throw error;
        const reconciled = await reconcileAmbiguousSessionCreate(provider, body, startedAt);
        if (reconciled) return reconciled;
        throw new ApiError(
          'The create request lost its response and may have succeeded. Refresh Sessions before retrying.',
          0,
          'network',
        );
      }
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

export function useBillingLimits() {
  const { provider, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.billingLimits,
    queryFn: async () => {
      if (!provider) throw new Error('Not authenticated');
      const orgId = (await provider.orgPath()).replace('/v3/organizations/', '');
      const [cycles, limits] = await Promise.all([
        listConsumptionCycles(provider),
        listDevinAcuLimits(provider),
      ]);
      const now = Math.floor(Date.now() / 1000);
      return {
        currentCycle: cycles.find((cycle) => cycle.after <= now && cycle.before > now),
        orgLimit: limits.find((limit) => limit.org_id === orgId),
      };
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
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions });
      const previous = queryClient.getQueryData<SessionResponse[]>(queryKeys.sessions);
      queryClient.setQueryData<SessionResponse[]>(queryKeys.sessions, (sessions) =>
        removeSessionFromBoard(sessions, sessionId),
      );
      return { previous };
    },
    onError: (_error, _sessionId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.sessions, context.previous);
    },
    onSettled: (_data, _error, sessionId) => {
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
    onSuccess: (_data, prUrl) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.prReview(prUrl) }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFolders });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFolders });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge });
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFolders });
    },
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
        getSearchMetrics(provider, query).catch(
          () => ({}) as Awaited<ReturnType<typeof getSearchMetrics>>,
        ),
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
