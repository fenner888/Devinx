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
  dailyConsumptionResponseSchema,
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
  return apiRequest<SessionResponse>(auth, paths.session(orgId, sessionId as `devin-${string}`), {
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
  const data = await apiRequest<{ items: SessionMessage[]; end_cursor: Cursor | null; has_next_page: boolean }>(auth, paths.messages(orgId, sessionId as `devin-${string}`), {
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
  const attribution = await auth.sessionAttribution();
  const body = { message, attachment_urls: attachmentUrls, ...attribution };
  sessionMessageCreateRequestSchema.parse(body);
  await apiRequest(auth, paths.messages(orgId, sessionId as `devin-${string}`), {
    method: 'POST',
    body,
  });
}

export async function archiveSession(auth: AuthProvider, sessionId: string): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.archive(orgId, sessionId as `devin-${string}`), { method: 'POST' });
}

export async function terminateSession(auth: AuthProvider, sessionId: string, archive = false): Promise<void> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  await apiRequest(auth, paths.session(orgId, sessionId as `devin-${string}`), {
    method: 'DELETE',
    query: { archive },
  });
}

export async function getTags(auth: AuthProvider, sessionId: string): Promise<string[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, sessionId as `devin-${string}`), {
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
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, sessionId as `devin-${string}`), {
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
  const data = await apiRequest<{ tags: string[] }>(auth, paths.tags(orgId, sessionId as `devin-${string}`), {
    method: 'PUT',
    body,
    schema: sessionTagsResponseSchema,
  });
  return data.tags;
}

export async function generateInsights(auth: AuthProvider, sessionId: string): Promise<InsightsGenerateResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<InsightsGenerateResponse>(auth, paths.insightsGenerate(orgId, sessionId as `devin-${string}`), {
    method: 'POST',
    schema: insightsGenerateResponseSchema,
  });
}

export async function getInsights(auth: AuthProvider, sessionId: string): Promise<SessionInsightsResponse> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  return apiRequest<SessionInsightsResponse>(auth, paths.insights(orgId, sessionId as `devin-${string}`), {
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

export async function getDailyConsumption(auth: AuthProvider, params?: { start_date?: string; end_date?: string }): Promise<DailyConsumptionResponse[]> {
  const orgPath = await auth.orgPath();
  const orgId = orgPath.replace('/v3/organizations/', '');
  const data = await apiRequest<DailyConsumptionResponse>(auth, paths.consumptionDaily(orgId), {
    method: 'GET',
    query: { start_date: params?.start_date, end_date: params?.end_date },
    schema: dailyConsumptionResponseSchema,
  });
  // Daily consumption returns a list directly or paginated — handle both.
  return Array.isArray(data) ? data : [data];
}
