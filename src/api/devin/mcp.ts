import { z } from 'zod';
import type { AuthProvider } from '@auth/AuthProvider';
import { ApiError } from './client';

const DEFAULT_MCP_URL = 'https://mcp.devin.ai/mcp';
const MCP_PROTOCOL_VERSION = '2025-06-18';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_CHARS = 4_000_000;

const jsonRpcResultSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown(),
});

const jsonRpcErrorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.unknown().optional(),
  }),
});

const initializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: z.record(z.unknown()),
  serverInfo: z.object({
    name: z.string(),
    version: z.string().optional(),
  }),
});

const toolContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const callToolResultSchema = z.object({
  content: z.array(toolContentSchema),
  structuredContent: z.record(z.unknown()).optional(),
  isError: z.boolean().optional().default(false),
});

const rawIntegrationSchema = z.record(z.unknown());
const repositoryNameSchema = z.string().trim().min(1).max(512);
const wikiQuestionSchema = z.string().trim().min(1).max(4_000);

type JsonRpcId = string | number;
type JsonRpcResult = z.infer<typeof jsonRpcResultSchema>;

export interface McpToolPayload {
  structuredContent?: Record<string, unknown>;
  text: string;
}

export interface IntegrationCatalogItem {
  id: string;
  name: string;
  description?: string;
  kind: 'integration' | 'mcp';
  status: 'installed' | 'not_installed' | 'unknown';
}

export interface IntegrationCatalog {
  integrations: IntegrationCatalogItem[];
  mcpServers: IntegrationCatalogItem[];
  summary?: string;
}

let requestId = 0;

function nextRequestId(): number {
  requestId += 1;
  return requestId;
}

function orgIdFromPath(path: string): string {
  const match = path.match(/\/organizations\/([^/]+)/);
  if (!match?.[1]) throw new ApiError('Organization is unavailable', 404, 'not_found');
  return match[1];
}

function classifyMcpStatus(status: number): ApiError {
  if (status === 401) return new ApiError('Devin MCP authentication failed', status, 'auth');
  if (status === 403)
    return new ApiError('This connection cannot access Devin MCP', status, 'permission');
  if (status === 404) return new ApiError('Devin MCP is unavailable', status, 'not_found');
  if (status === 429) return new ApiError('Devin MCP is rate limited', status, 'rate_limited');
  if (status >= 500) return new ApiError('Devin MCP is temporarily unavailable', status, 'server');
  return new ApiError('Devin MCP request failed', status, 'unknown');
}

function parseJsonRpcCandidate(value: unknown, expectedId: JsonRpcId): JsonRpcResult | null {
  const error = jsonRpcErrorSchema.safeParse(value);
  if (error.success && (error.data.id === undefined || error.data.id === expectedId)) {
    throw new ApiError('Devin MCP rejected the request', 400, 'unknown');
  }

  const result = jsonRpcResultSchema.safeParse(value);
  if (result.success && result.data.id === expectedId) return result.data;
  return null;
}

function parseJsonRpcResponse(body: string, expectedId: JsonRpcId): JsonRpcResult {
  if (body.length > MAX_RESPONSE_CHARS) {
    throw new ApiError('Devin MCP response was too large', 0, 'schema');
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    const result = parseJsonRpcCandidate(parsed, expectedId);
    if (result) return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const result = parseJsonRpcCandidate(JSON.parse(data) as unknown, expectedId);
      if (result) return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }
  }

  throw new ApiError('Devin MCP returned an invalid response', 0, 'schema');
}

async function postMcp(
  auth: AuthProvider,
  body: Record<string, unknown>,
  expectedId?: JsonRpcId,
  sessionId?: string,
): Promise<{ result?: JsonRpcResult; sessionId?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const orgId = orgIdFromPath(await auth.orgPath());
    const headers: Record<string, string> = {
      ...(await auth.authHeaders()),
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      'X-Org-Id': orgId,
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const response = await fetch(process.env.EXPO_PUBLIC_DEVIN_MCP_URL || DEFAULT_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) throw classifyMcpStatus(response.status);
    const returnedSessionId = response.headers.get('Mcp-Session-Id') ?? sessionId;
    if (expectedId === undefined || response.status === 202) {
      return { sessionId: returnedSessionId };
    }
    const responseBody = await response.text();
    return {
      result: parseJsonRpcResponse(responseBody, expectedId),
      sessionId: returnedSessionId,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|timeout|network|fetch/i.test(message)) {
      throw new ApiError('Could not reach Devin MCP', 0, 'network');
    }
    throw new ApiError('Devin MCP request failed', 0, 'unknown');
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callDevinMcpTool(
  auth: AuthProvider,
  name: 'list_integrations' | 'read_wiki_structure' | 'read_wiki_contents' | 'ask_question',
  args: Record<string, unknown>,
): Promise<McpToolPayload> {
  const initializeId = nextRequestId();
  const initialized = await postMcp(
    auth,
    {
      jsonrpc: '2.0',
      id: initializeId,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'DevinX', version: '0.1.0' },
      },
    },
    initializeId,
  );
  const initializeResult = initializeResultSchema.safeParse(initialized.result?.result);
  if (!initializeResult.success) {
    throw new ApiError('Devin MCP initialization was invalid', 0, 'schema');
  }

  await postMcp(
    auth,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    undefined,
    initialized.sessionId,
  );

  const callId = nextRequestId();
  const called = await postMcp(
    auth,
    {
      jsonrpc: '2.0',
      id: callId,
      method: 'tools/call',
      params: { name, arguments: args },
    },
    callId,
    initialized.sessionId,
  );
  const toolResult = callToolResultSchema.safeParse(called.result?.result);
  if (!toolResult.success) throw new ApiError('Devin MCP tool response was invalid', 0, 'schema');

  const text = toolResult.data.content
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n\n')
    .slice(0, MAX_RESPONSE_CHARS);
  if (toolResult.data.isError) {
    throw new ApiError('The requested Devin capability is unavailable', 400, 'unknown');
  }
  return { structuredContent: toolResult.data.structuredContent, text };
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function itemStatus(record: Record<string, unknown>): IntegrationCatalogItem['status'] {
  const installed = record.installed ?? record.is_installed ?? record.enabled ?? record.connected;
  if (installed === true) return 'installed';
  if (installed === false) return 'not_installed';
  const status = firstString(record, [
    'status',
    'install_status',
    'connection_status',
  ])?.toLowerCase();
  if (status && /not.installed|disconnected|disabled|inactive|available/.test(status)) {
    return 'not_installed';
  }
  if (status && /installed|connected|enabled|active/.test(status)) return 'installed';
  return 'unknown';
}

function normalizeCatalogItem(
  value: unknown,
  kind: IntegrationCatalogItem['kind'],
  index: number,
): IntegrationCatalogItem | null {
  const parsed = rawIntegrationSchema.safeParse(value);
  if (!parsed.success) return null;
  const name = firstString(parsed.data, ['name', 'display_name', 'title', 'provider', 'slug']);
  if (!name) return null;
  const id = firstString(parsed.data, ['id', 'slug', 'key', 'integration_id', 'server_id']);
  return {
    id: id ?? `${kind}-${index}-${name}`,
    name,
    description: firstString(parsed.data, ['description', 'summary', 'subtitle']),
    kind,
    status: itemStatus(parsed.data),
  };
}

function recordFromPayload(payload: McpToolPayload): Record<string, unknown> | undefined {
  if (payload.structuredContent) return payload.structuredContent;
  try {
    const parsed = rawIntegrationSchema.safeParse(JSON.parse(payload.text) as unknown);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function arrayForKeys(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export async function listIntegrationCatalog(auth: AuthProvider): Promise<IntegrationCatalog> {
  const payload = await callDevinMcpTool(auth, 'list_integrations', {});
  const record = recordFromPayload(payload);
  if (!record) return { integrations: [], mcpServers: [], summary: payload.text || undefined };

  const integrations = arrayForKeys(record, [
    'integrations',
    'native_integrations',
    'nativeIntegrations',
  ])
    .map((item, index) => normalizeCatalogItem(item, 'integration', index))
    .filter((item): item is IntegrationCatalogItem => item !== null);
  const mcpServers = arrayForKeys(record, ['mcp_servers', 'mcpServers', 'mcps', 'servers'])
    .map((item, index) => normalizeCatalogItem(item, 'mcp', index))
    .filter((item): item is IntegrationCatalogItem => item !== null);

  return { integrations, mcpServers, summary: payload.text || undefined };
}

export async function readWikiStructure(auth: AuthProvider, repoName: string): Promise<string> {
  const validatedRepoName = repositoryNameSchema.safeParse(repoName);
  if (!validatedRepoName.success) {
    throw new ApiError('Repository is invalid', 0, 'schema');
  }
  const payload = await callDevinMcpTool(auth, 'read_wiki_structure', {
    repoName: validatedRepoName.data,
  });
  return payload.text;
}

export async function readWikiContents(auth: AuthProvider, repoName: string): Promise<string> {
  const validatedRepoName = repositoryNameSchema.safeParse(repoName);
  if (!validatedRepoName.success) {
    throw new ApiError('Repository is invalid', 0, 'schema');
  }
  const payload = await callDevinMcpTool(auth, 'read_wiki_contents', {
    repoName: validatedRepoName.data,
  });
  return payload.text;
}

export async function askWikiQuestion(
  auth: AuthProvider,
  repoName: string,
  question: string,
): Promise<string> {
  const validated = z
    .object({ repoName: repositoryNameSchema, question: wikiQuestionSchema })
    .safeParse({ repoName, question });
  if (!validated.success) {
    throw new ApiError('Wiki question is invalid', 0, 'schema');
  }
  const payload = await callDevinMcpTool(auth, 'ask_question', validated.data);
  return payload.text;
}
