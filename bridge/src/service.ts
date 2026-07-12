import { basename } from 'node:path';

import { z } from 'zod';

import type { AcpLoadedSession, AcpModelCatalog, AcpSessionPage } from './acp';
import type { RateLimiter, RateLimitRule } from './rate-limit';
import type { ReplayGuard } from './replay';
import {
  authorizeRequest,
  type DeviceStore,
  type RequestAuthorization,
  type RequestRejection,
} from './security';
import {
  BRIDGE_PROTOCOL_VERSION,
  opaqueIdSchema,
  modelIdSchema,
  sessionCreateBodySchema,
  sessionCreateOptionsBodySchema,
  sessionListBodySchema,
  sessionLoadBodySchema,
  sessionPromptBodySchema,
} from './schemas';
import type { SessionHandleRegistry } from './session-handles';
import type { WorkspaceHandleRegistry } from './workspace-handles';

const MAX_LOCAL_SESSION_RESPONSE_BYTES = 192 * 1024;

const requestContextSchema = z
  .object({
    peerKey: z.string().min(1).max(128),
    now: z.number().int().nonnegative(),
  })
  .strict();

const serviceOptionsSchema = z
  .object({
    peerLimit: z.number().int().min(1).max(10_000).default(120),
    healthLimit: z.number().int().min(1).max(10_000).default(120),
    sessionListLimit: z.number().int().min(1).max(10_000).default(30),
    sessionLoadLimit: z.number().int().min(1).max(10_000).default(30),
    mutationLimit: z.number().int().min(1).max(10_000).default(10),
    windowMs: z
      .number()
      .int()
      .min(1_000)
      .max(60 * 60 * 1_000)
      .default(60_000),
  })
  .strict();

const localSessionSchema = z
  .object({
    id: z.string().regex(/^local_[A-Za-z0-9_-]{43}$/),
    origin: z.literal('computer'),
    workspaceName: z.string().min(1).max(160),
    hasTitle: z.boolean(),
    title: z.string().max(10_000).optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
    model: z
      .object({ id: modelIdSchema, name: z.string().min(1).max(160) })
      .strict()
      .optional(),
  })
  .strict();

const healthResponseSchema = z
  .object({
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
    status: z.literal('ready'),
    capabilities: z
      .object({
        sessionList: z.boolean(),
        sessionLoad: z.boolean(),
        sessionPrompt: z.boolean(),
      })
      .strict(),
  })
  .strict();

const localSessionPageSchema = z
  .object({
    sessions: z.array(localSessionSchema).max(5_000),
    nextCursor: z.string().min(1).max(4096).optional(),
  })
  .strict();

const localHistoryMessageSchema = z
  .object({
    sequence: z.number().int().positive(),
    source: z.enum(['user', 'devin']),
    text: z.string().max(100_000),
  })
  .strict();

const localLoadedSessionSchema = z
  .object({
    session: z
      .object({
        id: z.string().regex(/^local_[A-Za-z0-9_-]{43}$/),
        origin: z.literal('computer'),
        workspaceName: z.string().min(1).max(160),
        model: z
          .object({ id: modelIdSchema, name: z.string().min(1).max(160) })
          .strict()
          .optional(),
      })
      .strict(),
    messages: z.array(localHistoryMessageSchema).max(200),
    truncated: z.boolean(),
  })
  .strict();

type LocalLoadedSession = z.infer<typeof localLoadedSessionSchema>;

export interface SessionDiscoveryAdapter {
  isSessionListSupported(): boolean;
  listSessions(input?: unknown): Promise<AcpSessionPage>;
  isSessionLoadSupported(): boolean;
  loadSession(sessionId: string): Promise<AcpLoadedSession>;
  isSessionPromptSupported(): boolean;
  promptSession(
    sessionId: string,
    text: string,
  ): Promise<void | { continuedSessionId: string }>;
  createContinuation?(cwd: string, context: string, text: string): Promise<string>;
  isSessionCreateSupported?(): boolean;
  listModelCatalog?(): Promise<AcpModelCatalog>;
  listCreateOptions?(): Promise<{
    workspaces: Array<{ path: string }>;
    models: Array<{
      id: string;
      name?: string;
      description?: string;
      supportsImages?: boolean;
      badge?: 'new' | 'free_promo';
      recent?: boolean;
      recommended?: boolean;
    }>;
    defaultModelId?: string | null;
    catalogSource?: 'live' | 'recent';
  }>;
  createSession?(cwd: string, modelId: string | null, text: string): Promise<string>;
}

export interface BridgeServiceOptions {
  bridgeId: string;
  devices: DeviceStore & { revoke?(deviceId: string): Promise<boolean> };
  replayGuard: ReplayGuard;
  rateLimiter: RateLimiter;
  sessionHandles: SessionHandleRegistry;
  workspaceHandles: WorkspaceHandleRegistry;
  sessions: SessionDiscoveryAdapter;
  peerLimit?: number;
  healthLimit?: number;
  sessionListLimit?: number;
  sessionLoadLimit?: number;
  mutationLimit?: number;
  windowMs?: number;
}

export interface BridgeRequestContext {
  peerKey: string;
  now: number;
}

export interface BridgeServiceResponse {
  status: 200 | 400 | 404 | 429 | 503;
  body: unknown;
}

function publicRejection(rejection: RequestRejection): BridgeServiceResponse {
  return { status: rejection.status, body: rejection.body };
}

function cleanDisplayText(value: string, maximumLength: number, fallback: string): string {
  const characters = [...value].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? ' ' : character;
  });
  const collapsed = characters.join('').replace(/\s+/g, ' ').trim();
  const clean = [...collapsed].slice(0, maximumLength).join('');
  return clean || fallback;
}

function modelDisplayName(modelId: string): string {
  const words = modelId.split(/[-_]+/).filter(Boolean);
  const labels: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    if (/^\d+$/.test(word)) {
      const versionParts = [word];
      while (/^\d+$/.test(words[index + 1] ?? '')) {
        versionParts.push(words[index + 1] ?? '');
        index += 1;
      }
      labels.push(versionParts.join('.'));
      continue;
    }
    labels.push(
      (() => {
      if (/^\d+(?:\.\d+)*$/.test(word)) return word;
      if (word.toLowerCase() === 'gpt') return 'GPT';
      if (word.toLowerCase() === 'glm') return 'GLM';
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
      })(),
    );
  }
  const label = labels.join(' ');
  return cleanDisplayText(label, 160, 'Default');
}

function workspaceDisplayNames(workspaces: Array<{ path: string }>): string[] {
  const bases = workspaces.map((workspace) =>
    cleanDisplayText(basename(workspace.path), 150, 'Workspace'),
  );
  const totals = new Map<string, number>();
  for (const base of bases) totals.set(base, (totals.get(base) ?? 0) + 1);
  const seen = new Map<string, number>();
  return bases.map((base) => {
    if ((totals.get(base) ?? 0) === 1) return base;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return `${base} (${occurrence})`;
  });
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function withRenumberedMessages(
  response: LocalLoadedSession,
  messages: LocalLoadedSession['messages'],
  truncated: boolean,
): LocalLoadedSession {
  return {
    ...response,
    messages: messages.map((message, index) => ({ ...message, sequence: index + 1 })),
    truncated,
  };
}

function fitLoadedSessionResponse(input: LocalLoadedSession): LocalLoadedSession {
  let response = input;
  while (
    serializedBytes(response) > MAX_LOCAL_SESSION_RESPONSE_BYTES &&
    response.messages.length > 1
  ) {
    response = withRenumberedMessages(response, response.messages.slice(1), true);
  }
  if (serializedBytes(response) <= MAX_LOCAL_SESSION_RESPONSE_BYTES) return response;

  const message = response.messages[0];
  if (!message) throw new Error('Local session response exceeded its byte limit');
  const characters = [...message.text];
  let minimumRemoved = 0;
  let maximumRemoved = characters.length;
  let fitted: LocalLoadedSession | null = null;
  while (minimumRemoved <= maximumRemoved) {
    const removed = Math.floor((minimumRemoved + maximumRemoved) / 2);
    const candidate = withRenumberedMessages(
      response,
      [{ ...message, text: characters.slice(removed).join('') }],
      true,
    );
    if (serializedBytes(candidate) <= MAX_LOCAL_SESSION_RESPONSE_BYTES) {
      fitted = candidate;
      maximumRemoved = removed - 1;
    } else {
      minimumRemoved = removed + 1;
    }
  }
  if (!fitted) throw new Error('Local session response exceeded its byte limit');
  return fitted;
}

export class BridgeService {
  private readonly bridgeId: string;
  private readonly rates: z.infer<typeof serviceOptionsSchema>;
  private listing = false;
  private loading = false;

  constructor(private readonly dependencies: BridgeServiceOptions) {
    this.bridgeId = opaqueIdSchema.parse(dependencies.bridgeId);
    this.rates = serviceOptionsSchema.parse({
      peerLimit: dependencies.peerLimit,
      healthLimit: dependencies.healthLimit,
      sessionListLimit: dependencies.sessionListLimit,
      sessionLoadLimit: dependencies.sessionLoadLimit,
      mutationLimit: dependencies.mutationLimit,
      windowMs: dependencies.windowMs,
    });
  }

  async handle(input: unknown, contextInput: unknown): Promise<BridgeServiceResponse> {
    const contextResult = requestContextSchema.safeParse(contextInput);
    if (!contextResult.success) {
      return { status: 400, body: { error: 'invalid_request' } };
    }
    const context = contextResult.data;
    if (!this.consumeRate(`peer:${context.peerKey}`, this.rates.peerLimit, context.now)) {
      return { status: 429, body: { error: 'rate_limited' } };
    }

    const authorization = authorizeRequest(input, {
      bridgeId: this.bridgeId,
      devices: this.dependencies.devices,
      replayGuard: this.dependencies.replayGuard,
      now: context.now,
    });
    if (!authorization.ok) return publicRejection(authorization);

    const deviceLimit =
      authorization.request.method === 'session.list'
        ? this.rates.sessionListLimit
        : authorization.request.method === 'session.load'
          ? this.rates.sessionLoadLimit
        : authorization.request.method === 'bridge.health'
          ? this.rates.healthLimit
          : this.rates.mutationLimit;
    if (
      !this.consumeRate(
        `device:${authorization.request.device.deviceId}:${authorization.request.method}`,
        deviceLimit,
        context.now,
      )
    ) {
      return { status: 429, body: { error: 'rate_limited' } };
    }

    if (authorization.request.method === 'bridge.health') {
      return {
        status: 200,
        body: healthResponseSchema.parse({
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          status: 'ready',
          capabilities: {
            sessionList: this.dependencies.sessions.isSessionListSupported(),
            sessionLoad:
              this.dependencies.sessions.isSessionLoadSupported() &&
              authorization.request.device.permissions.includes('session:content:read'),
            sessionPrompt:
              this.dependencies.sessions.isSessionPromptSupported() &&
              authorization.request.device.permissions.includes('session:prompt:send'),
          },
        }),
      };
    }
    if (authorization.request.method === 'device.revoke') {
      try {
        const revoked = await this.dependencies.devices.revoke?.(
          authorization.request.device.deviceId,
        );
        return revoked
          ? { status: 200, body: { revoked: true } }
          : { status: 503, body: { error: 'temporarily_unavailable' } };
      } catch {
        return { status: 503, body: { error: 'temporarily_unavailable' } };
      }
    }
    if (authorization.request.method === 'session.list') {
      return this.listSessions(authorization, context.now);
    }
    if (authorization.request.method === 'session.load') {
      return this.loadSession(authorization, context.now);
    }
    if (authorization.request.method === 'session.prompt') {
      return this.promptSession(authorization, context.now);
    }
    if (authorization.request.method === 'session.create_options') {
      return this.createOptions(authorization, context.now);
    }
    if (authorization.request.method === 'session.create') {
      return this.createSession(authorization, context.now);
    }
    return { status: 404, body: { error: 'not_found' } };
  }

  private consumeRate(key: string, limit: number, now: number): boolean {
    const rule: RateLimitRule = { limit, windowMs: this.rates.windowMs };
    return this.dependencies.rateLimiter.consume(key, rule, now);
  }

  private async listSessions(
    authorization: RequestAuthorization,
    now: number,
  ): Promise<BridgeServiceResponse> {
    if (!this.dependencies.sessions.isSessionListSupported()) {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
    if (this.listing) return { status: 429, body: { error: 'busy' } };
    this.listing = true;
    try {
      const body = sessionListBodySchema.parse(authorization.request.body);
      const page = await this.dependencies.sessions.listSessions(body);
      const mayReadTitles =
        authorization.request.device.permissions.includes('session:content:read');
      const response = localSessionPageSchema.parse({
        sessions: page.sessions.map((session) => ({
          id: this.dependencies.sessionHandles.register(session.sessionId, now),
          origin: 'computer',
          workspaceName: cleanDisplayText(basename(session.cwd), 160, 'Workspace'),
          hasTitle: Boolean(session.title),
          title:
            mayReadTitles && session.title
              ? cleanDisplayText(session.title, 10_000, 'Untitled session')
              : undefined,
          updatedAt: session.updatedAt,
          model: session.modelId
            ? { id: session.modelId, name: modelDisplayName(session.modelId) }
            : undefined,
        })),
        nextCursor: page.nextCursor,
      });
      return { status: 200, body: response };
    } catch {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    } finally {
      this.listing = false;
    }
  }

  private async loadSession(
    authorization: RequestAuthorization,
    now: number,
  ): Promise<BridgeServiceResponse> {
    if (!this.dependencies.sessions.isSessionLoadSupported()) {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
    const body = sessionLoadBodySchema.parse(authorization.request.body);
    const rawSessionId = this.dependencies.sessionHandles.resolve(body.sessionId, now);
    if (!rawSessionId) return { status: 404, body: { error: 'not_found' } };
    if (this.loading) return { status: 429, body: { error: 'busy' } };

    this.loading = true;
    try {
      const loaded = await this.dependencies.sessions.loadSession(rawSessionId);
      if (loaded.sessionId !== rawSessionId) {
        throw new Error('Loaded ACP session did not match the requested session');
      }
      const response = localLoadedSessionSchema.parse({
        session: {
          id: body.sessionId,
          origin: 'computer',
          workspaceName: cleanDisplayText(basename(loaded.cwd), 160, 'Workspace'),
          model: loaded.modelId
            ? { id: loaded.modelId, name: modelDisplayName(loaded.modelId) }
            : undefined,
        },
        messages: loaded.messages.map((message, index) => ({
          sequence: index + 1,
          source: message.source,
          text: message.text,
        })),
        truncated: loaded.truncated,
      });
      return { status: 200, body: fitLoadedSessionResponse(response) };
    } catch {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    } finally {
      this.loading = false;
    }
  }

  private async promptSession(
    authorization: RequestAuthorization,
    now: number,
  ): Promise<BridgeServiceResponse> {
    if (!this.dependencies.sessions.isSessionPromptSupported()) {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
    const body = sessionPromptBodySchema.parse(authorization.request.body);
    const rawSessionId = this.dependencies.sessionHandles.resolve(body.sessionId, now);
    if (!rawSessionId) return { status: 404, body: { error: 'not_found' } };
    try {
      const result = await this.dependencies.sessions.promptSession(rawSessionId, body.text);
      const continuedSessionId = result?.continuedSessionId;
      return {
        status: 200,
        body: {
          accepted: true,
          ...(continuedSessionId
            ? { sessionId: this.dependencies.sessionHandles.register(continuedSessionId, now) }
            : {}),
        },
      };
    } catch {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
  }

  private async createOptions(
    authorization: RequestAuthorization,
    now: number,
  ): Promise<BridgeServiceResponse> {
    sessionCreateOptionsBodySchema.parse(authorization.request.body);
    if (
      !this.dependencies.sessions.isSessionCreateSupported?.() ||
      !this.dependencies.sessions.listCreateOptions
    ) {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
    try {
      const options = await this.dependencies.sessions.listCreateOptions();
      const workspaceNames = workspaceDisplayNames(options.workspaces);
      return {
        status: 200,
        body: z
          .object({
            workspaces: z
              .array(
                z
                  .object({
                    id: z.string().regex(/^workspace_[A-Za-z0-9_-]{43}$/),
                    name: z.string().min(1).max(160),
                  })
                  .strict(),
              )
              .max(100),
            models: z
              .array(
                z
                  .object({
                    id: modelIdSchema,
                    name: z.string().min(1).max(160),
                    description: z.string().min(1).max(500).optional(),
                    supportsImages: z.boolean().optional(),
                    badge: z.enum(['new', 'free_promo']).optional(),
                    recent: z.boolean(),
                    recommended: z.boolean(),
                  })
                  .strict(),
              )
              .max(200),
            defaultModelId: modelIdSchema.nullable(),
            catalogSource: z.enum(['live', 'recent']),
          })
          .strict()
          .superRefine((value, context) => {
            const modelIds = value.models.map((model) => model.id);
            if (new Set(modelIds).size !== modelIds.length) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['models'],
                message: 'Model IDs must be unique',
              });
            }
            if (
              value.defaultModelId !== null &&
              !value.models.some(
                (model) => model.id === value.defaultModelId && model.recommended,
              )
            ) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultModelId'],
                message: 'Default model must be present and recommended',
              });
            }
          })
          .parse({
            workspaces: options.workspaces.map((workspace, index) => ({
              id: this.dependencies.workspaceHandles.register(workspace.path, now),
              name: workspaceNames[index] ?? 'Workspace',
            })),
            models: options.models.map((model) => ({
              id: model.id,
              name: cleanDisplayText(model.name ?? modelDisplayName(model.id), 160, 'Default'),
              ...(model.description
                ? { description: cleanDisplayText(model.description, 500, 'Model option') }
                : {}),
              ...(typeof model.supportsImages === 'boolean'
                ? { supportsImages: model.supportsImages }
                : {}),
              ...(model.badge ? { badge: model.badge } : {}),
              recent: model.recent === true,
              recommended: model.recommended === true,
            })),
            defaultModelId: options.defaultModelId ?? null,
            catalogSource: options.catalogSource ?? 'recent',
          }),
      };
    } catch {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
  }

  private async createSession(
    authorization: RequestAuthorization,
    now: number,
  ): Promise<BridgeServiceResponse> {
    const body = sessionCreateBodySchema.parse(authorization.request.body);
    const cwd = this.dependencies.workspaceHandles.resolve(body.workspaceId, now);
    if (!cwd) return { status: 404, body: { error: 'not_found' } };
    if (
      !this.dependencies.sessions.isSessionCreateSupported?.() ||
      !this.dependencies.sessions.listCreateOptions ||
      !this.dependencies.sessions.createSession
    ) {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
    try {
      const options = await this.dependencies.sessions.listCreateOptions();
      if (!options.workspaces.some((workspace) => workspace.path === cwd)) {
        return { status: 404, body: { error: 'not_found' } };
      }
      const modelId = body.modelId ?? null;
      if (modelId && !options.models.some((model) => model.id === modelId)) {
        return { status: 404, body: { error: 'not_found' } };
      }
      const sessionId = await this.dependencies.sessions.createSession(cwd, modelId, body.text);
      return {
        status: 200,
        body: { accepted: true, sessionId: this.dependencies.sessionHandles.register(sessionId, now) },
      };
    } catch {
      return { status: 503, body: { error: 'temporarily_unavailable' } };
    }
  }
}
