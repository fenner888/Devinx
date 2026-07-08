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
