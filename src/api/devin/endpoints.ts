/**
 * Devin API endpoints — typed functions per §8.5.
 * Each function calls the client and parses through the matching zod schema.
 * Components never import this; hooks/queries do.
 */

import type { AuthProvider } from '@auth/AuthProvider';
import { apiRequest } from './client';
import { paths } from './types';
import {
  sessionListResponseSchema,
  sessionResponseSchema,
  sessionMessageListResponseSchema,
  sessionMessageCreateRequestSchema,
  sessionCreateRequestSchema,
  sessionTagsResponseSchema,
  sessionTagsUpdateRequestSchema,
  insightsGenerateResponseSchema,
  sessionInsightsResponseSchema,
  playbookListResponseSchema,
  knowledgeNoteListResponseSchema,
  secretListResponseSchema,
  attachmentResponseSchema,
  consumptionResponseSchema,
  scheduleResponseSchema,
  scheduleListResponseSchema,
  prReviewResponseSchema,
  codeScanFindingListResponseSchema,
  knowledgeNoteCreateRequestSchema,
  knowledgeNoteResponseSchema,
  playbookCreateRequestSchema,
  playbookResponseSchema,
  secretCreateRequestSchema,
  secretResponseSchema,
  sessionMetricsSchema,
  prMetricsSchema,
  searchMetricsSchema,
  activeUsersResponseSchema,
  repositoryListResponseSchema,
} from './schemas';
import type {
  SessionResponse,
  SessionsQueryParams,
  SessionMessage,
  SessionCreateRequest,
  SessionTagsUpdateRequest,
  PlaybookResponse,
  KnowledgeNoteResponse,
  SecretResponse,
  AttachmentResponse,
  DailyConsumptionResponse,
  SessionInsightsResponse,
  InsightsGenerateResponse,
  ScheduleResponse,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  PrReviewResponse,
  CodeScanFinding,
  KnowledgeNoteCreateRequest,
  KnowledgeNoteUpdateRequest,
  PlaybookCreateRequest,
  PlaybookUpdateRequest,
  SecretCreateRequest,
  SessionMetrics,
  PrMetrics,
  SearchMetrics,
  ActiveUserPeriod,
  MetricsQuery,
  RepositoryResponse,
  Cursor,
} from './types';

/**
 * URL paths take the devin- prefixed ID (`devin_id`), but list/get responses
 * return `session_id` WITHOUT the prefix — normalize before building paths.
 */
function toDevinId(sessionId: string): `devin-${string}` {
  return (sessionId.startsWith('devin-') ? sessionId : `devin-${sessionId}`) as `devin-${string}`;
}

export async function listSessions(
  auth: AuthProvider,
  params?: SessionsQueryParams,
): Promise<{ items: SessionResponse[]; endCursor: Cursor | null; hasNextPage: boolean }> {
  const orgPath = await auth.orgPath();
  const data = await apiRequest<{ items: SessionResponse[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.sessions(orgPath.replace('/v3/organizations/', '')), {
    method: 'GET',
    query: params as Record<string, string | number | boolean | string[] | null | undefined>,
    schema: sessionListResponseSchema,
  });
  return { items: data.items, endCursor: data.end_cursor, hasNextPage: data.has_next_page };
}

export async function getSession(auth: AuthProvider, sessionId: string): Promise<SessionResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<SessionResponse>(auth, paths.session(orgId, toDevinId(sessionId)), {
    method: 'GET',
    schema: sessionResponseSchema,
  });
}

export async function createSession(
  auth: AuthProvider,
  body: SessionCreateRequest,
): Promise<SessionResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  // Merge attribution (create_as_user_id) from the auth provider.
  const attribution = await auth.sessionAttribution();
  const merged = { ...body, ...attribution };
  // Validate outbound payload (spec §10.7).
  sessionCreateRequestSchema.parse(merged);
  return apiRequest<SessionResponse>(auth, paths.sessions(orgId), {
    method: 'POST',
    body: merged,
    schema: sessionResponseSchema,
  });
}

export async function listMessages(
  auth: AuthProvider,
  sessionId: string,
  params?: { after?: Cursor | null; first?: number },
): Promise<{ items: SessionMessage[]; endCursor: Cursor | null; hasNextPage: boolean }> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ items: SessionMessage[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.messages(orgId, toDevinId(sessionId)), {
    method: 'GET',
    query: { after: params?.after, first: params?.first },
    schema: sessionMessageListResponseSchema,
  });
  return { items: data.items, endCursor: data.end_cursor, hasNextPage: data.has_next_page };
}

export async function sendMessage(
  auth: AuthProvider,
  sessionId: string,
  message: string,
  attachmentUrls?: string[],
): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  // The message endpoint attributes via message_as_user_id (the session-create
  // field is create_as_user_id) — spreading sessionAttribution() here silently
  // dropped attribution through .passthrough().
  const attribution = await auth.sessionAttribution();
  const body = {
    message,
    attachment_urls: attachmentUrls,
    ...(attribution.create_as_user_id
      ? { message_as_user_id: attribution.create_as_user_id }
      : {}),
  };
  sessionMessageCreateRequestSchema.parse(body);
  await apiRequest(auth, paths.messages(orgId, toDevinId(sessionId)), {
    method: 'POST',
    body,
  });
}

export async function archiveSession(auth: AuthProvider, sessionId: string): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.archive(orgId, toDevinId(sessionId)), { method: 'POST' });
}

export async function terminateSession(auth: AuthProvider, sessionId: string, archive = false): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.session(orgId, toDevinId(sessionId)), {
    method: 'DELETE',
    query: { archive },
  });
}

export async function getTags(auth: AuthProvider, sessionId: string): Promise<string[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, toDevinId(sessionId)), {
    method: 'GET',
    schema: sessionTagsResponseSchema,
  });
  return data.tags;
}

export async function addTags(auth: AuthProvider, sessionId: string, tags: string[]): Promise<string[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  // POST appends tags.
  const body: SessionTagsUpdateRequest = { tags };
  sessionTagsUpdateRequestSchema.parse(body);
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, toDevinId(sessionId)), {
    method: 'POST',
    body,
    schema: sessionTagsResponseSchema,
  });
  return data.tags;
}

export async function replaceTags(auth: AuthProvider, sessionId: string, tags: string[]): Promise<string[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  // PUT replaces all tags (used for remove — spec §8.5, api-deltas D5).
  const body: SessionTagsUpdateRequest = { tags };
  sessionTagsUpdateRequestSchema.parse(body);
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, toDevinId(sessionId)), {
    method: 'PUT',
    body,
    schema: sessionTagsResponseSchema,
  });
  return data.tags;
}

export async function generateInsights(auth: AuthProvider, sessionId: string): Promise<InsightsGenerateResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<InsightsGenerateResponse>(auth, paths.insightsGenerate(orgId, toDevinId(sessionId)), {
    method: 'POST',
    schema: insightsGenerateResponseSchema,
  });
}

export async function getInsights(auth: AuthProvider, sessionId: string): Promise<SessionInsightsResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<SessionInsightsResponse>(auth, paths.insights(orgId, toDevinId(sessionId)), {
    method: 'GET',
    schema: sessionInsightsResponseSchema,
  });
}

export async function listPlaybooks(auth: AuthProvider): Promise<PlaybookResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ items: PlaybookResponse[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.playbooks(orgId), {
    method: 'GET',
    schema: playbookListResponseSchema,
  });
  return data.items;
}

export async function listKnowledge(auth: AuthProvider): Promise<KnowledgeNoteResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ items: KnowledgeNoteResponse[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.knowledge(orgId), {
    method: 'GET',
    schema: knowledgeNoteListResponseSchema,
  });
  return data.items;
}

export async function listSecrets(auth: AuthProvider): Promise<SecretResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ items: SecretResponse[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.secrets(orgId), {
    method: 'GET',
    schema: secretListResponseSchema,
  });
  return data.items;
}

export async function uploadAttachment(auth: AuthProvider, file: { name: string; type: string; uri: string }): Promise<AttachmentResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const headers = await auth.authHeaders();
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  const base = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.devin.ai';
  // Manual AbortController — AbortSignal.timeout is unreliable on RN runtimes.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${base}${paths.attachments(orgId)}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Attachment upload failed: ${res.status}`);
  const json = await res.json();
  return attachmentResponseSchema.parse(json);
}

interface ConsumptionEnvelope {
  total_acus?: number;
  consumption_by_date: {
    date: number | string;
    acus?: number;
    acus_by_product: Record<string, number | null>;
  }[];
}

export async function getDailyConsumption(auth: AuthProvider, params?: { time_after?: number; time_before?: number }): Promise<DailyConsumptionResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<ConsumptionEnvelope>(auth, paths.consumptionDaily(orgId), {
    method: 'GET',
    query: { time_after: params?.time_after, time_before: params?.time_before },
    schema: consumptionResponseSchema,
  });
  // Normalize to the app shape: unix-integer dates (midnight PST = 08:00 UTC,
  // so the UTC calendar date matches the PST billing date) → YYYY-MM-DD,
  // null product values → 0.
  return data.consumption_by_date
    .map((d) => ({
      date: typeof d.date === 'number'
        ? new Date(d.date * 1000).toISOString().slice(0, 10)
        : d.date.slice(0, 10),
      acus: d.acus,
      acus_by_product: Object.fromEntries(
        Object.entries(d.acus_by_product).map(([product, acus]) => [product, acus ?? 0]),
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Schedules (Automations)
// ---------------------------------------------------------------------------

/** The API names the sched- ID `scheduled_session_id`; normalize to schedule_id. */
function normalizeSchedule(raw: Record<string, unknown>): ScheduleResponse {
  const schedule = raw as unknown as ScheduleResponse & { scheduled_session_id?: string };
  return { ...schedule, schedule_id: schedule.schedule_id ?? schedule.scheduled_session_id ?? '' };
}

export async function listSchedules(auth: AuthProvider): Promise<ScheduleResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const items: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const data: { items: Record<string, unknown>[]; end_cursor?: string | null; has_next_page?: boolean } =
      await apiRequest(auth, paths.schedules(orgId), {
        method: 'GET',
        query: { first: 100, after: cursor },
        schema: scheduleListResponseSchema,
      });
    items.push(...data.items);
    if (!data.has_next_page || !data.end_cursor) break;
    cursor = data.end_cursor;
  }
  return items.map(normalizeSchedule);
}

export async function createSchedule(auth: AuthProvider, body: ScheduleCreateRequest): Promise<ScheduleResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const raw = await apiRequest<Record<string, unknown>>(auth, paths.schedules(orgId), {
    method: 'POST',
    body,
    schema: scheduleResponseSchema,
  });
  return normalizeSchedule(raw);
}

export async function updateSchedule(auth: AuthProvider, scheduleId: string, body: ScheduleUpdateRequest): Promise<ScheduleResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const raw = await apiRequest<Record<string, unknown>>(auth, paths.schedule(orgId, scheduleId), {
    method: 'PATCH',
    body,
    schema: scheduleResponseSchema,
  });
  return normalizeSchedule(raw);
}

export async function deleteSchedule(auth: AuthProvider, scheduleId: string): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.schedule(orgId, scheduleId), { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// PR Reviews (Devin Review)
// ---------------------------------------------------------------------------

export async function triggerPrReview(auth: AuthProvider, prUrl: string): Promise<PrReviewResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<PrReviewResponse>(auth, paths.prReviews(orgId), {
    method: 'POST',
    body: { pr_url: prUrl },
    schema: prReviewResponseSchema,
  });
}

export async function getPrReview(auth: AuthProvider, prUrl: string): Promise<PrReviewResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<PrReviewResponse>(auth, paths.prReviews(orgId), {
    method: 'GET',
    query: { pr_url: prUrl },
    schema: prReviewResponseSchema,
  });
}

// ---------------------------------------------------------------------------
// Code scans (Devin Security — enterprise-scoped)
// ---------------------------------------------------------------------------

export async function listCodeScanFindings(auth: AuthProvider): Promise<CodeScanFinding[]> {
  const items: CodeScanFinding[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const data: { items: CodeScanFinding[]; end_cursor?: string | null; has_next_page?: boolean } =
      await apiRequest(auth, paths.codeScanFindings(), {
        method: 'GET',
        query: { first: 100, after: cursor },
        schema: codeScanFindingListResponseSchema,
      });
    items.push(...data.items);
    if (!data.has_next_page || !data.end_cursor) break;
    cursor = data.end_cursor;
  }
  return items;
}

export async function remediateFinding(auth: AuthProvider, scanId: string, findingId: string): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.codeScanRemediate(orgId, scanId, findingId), { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Resource management (Knowledge / Playbooks / Secrets)
// ---------------------------------------------------------------------------

async function orgIdOf(auth: AuthProvider): Promise<string> {
  return (await auth.orgPath()).replace('/v3/organizations/', '');
}

export async function createKnowledgeNote(auth: AuthProvider, body: KnowledgeNoteCreateRequest): Promise<KnowledgeNoteResponse> {
  knowledgeNoteCreateRequestSchema.parse(body);
  return apiRequest<KnowledgeNoteResponse>(auth, paths.knowledge(await orgIdOf(auth)), {
    method: 'POST',
    body,
    schema: knowledgeNoteResponseSchema,
  });
}

export async function updateKnowledgeNote(auth: AuthProvider, noteId: string, body: KnowledgeNoteUpdateRequest): Promise<KnowledgeNoteResponse> {
  return apiRequest<KnowledgeNoteResponse>(auth, paths.knowledgeNote(await orgIdOf(auth), noteId), {
    method: 'PUT',
    body,
    schema: knowledgeNoteResponseSchema,
  });
}

export async function deleteKnowledgeNote(auth: AuthProvider, noteId: string): Promise<void> {
  await apiRequest(auth, paths.knowledgeNote(await orgIdOf(auth), noteId), { method: 'DELETE' });
}

export async function createPlaybook(auth: AuthProvider, body: PlaybookCreateRequest): Promise<PlaybookResponse> {
  playbookCreateRequestSchema.parse(body);
  return apiRequest<PlaybookResponse>(auth, paths.playbooks(await orgIdOf(auth)), {
    method: 'POST',
    body,
    schema: playbookResponseSchema,
  });
}

export async function updatePlaybook(auth: AuthProvider, playbookId: string, body: PlaybookUpdateRequest): Promise<PlaybookResponse> {
  return apiRequest<PlaybookResponse>(auth, paths.playbook(await orgIdOf(auth), playbookId), {
    method: 'PUT',
    body,
    schema: playbookResponseSchema,
  });
}

export async function deletePlaybook(auth: AuthProvider, playbookId: string): Promise<void> {
  await apiRequest(auth, paths.playbook(await orgIdOf(auth), playbookId), { method: 'DELETE' });
}

export async function createSecret(auth: AuthProvider, body: SecretCreateRequest): Promise<SecretResponse> {
  secretCreateRequestSchema.parse(body);
  return apiRequest<SecretResponse>(auth, paths.secrets(await orgIdOf(auth)), {
    method: 'POST',
    body,
    schema: secretResponseSchema,
  });
}

export async function deleteSecret(auth: AuthProvider, secretId: string): Promise<void> {
  await apiRequest(auth, paths.secret(await orgIdOf(auth), secretId), { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Org metrics (Analytics)
// ---------------------------------------------------------------------------

export async function getSessionMetrics(auth: AuthProvider, query?: MetricsQuery): Promise<SessionMetrics> {
  return apiRequest<SessionMetrics>(auth, paths.metricsSessions(await orgIdOf(auth)), {
    method: 'GET',
    query: { time_after: query?.time_after, time_before: query?.time_before },
    schema: sessionMetricsSchema,
  });
}

export async function getPrMetrics(auth: AuthProvider, query?: MetricsQuery): Promise<PrMetrics> {
  return apiRequest<PrMetrics>(auth, paths.metricsPrs(await orgIdOf(auth)), {
    method: 'GET',
    query: { time_after: query?.time_after, time_before: query?.time_before },
    schema: prMetricsSchema,
  });
}

export async function getSearchMetrics(auth: AuthProvider, query?: MetricsQuery): Promise<SearchMetrics> {
  return apiRequest<SearchMetrics>(auth, paths.metricsSearches(await orgIdOf(auth)), {
    method: 'GET',
    query: { time_after: query?.time_after, time_before: query?.time_before },
    schema: searchMetricsSchema,
  });
}

export async function getWeeklyActiveUsers(auth: AuthProvider, query?: MetricsQuery): Promise<ActiveUserPeriod[]> {
  const data = await apiRequest<ActiveUserPeriod[] | { items: ActiveUserPeriod[] }>(auth, paths.metricsWau(await orgIdOf(auth)), {
    method: 'GET',
    query: { time_after: query?.time_after, time_before: query?.time_before },
    schema: activeUsersResponseSchema,
  });
  return Array.isArray(data) ? data : data.items;
}

// ---------------------------------------------------------------------------
// Repositories (v3beta1)
// ---------------------------------------------------------------------------

export async function listRepositories(auth: AuthProvider): Promise<RepositoryResponse[]> {
  const data = await apiRequest<{ items: RepositoryResponse[] }>(auth, paths.repositories(await orgIdOf(auth)), {
    method: 'GET',
    query: { first: 100 },
    schema: repositoryListResponseSchema,
  });
  return data.items;
}
