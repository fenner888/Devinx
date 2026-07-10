import { basename } from 'node:path';

import { z } from 'zod';

import type { AcpSessionPage } from './acp';
import type { RateLimiter, RateLimitRule } from './rate-limit';
import type { ReplayGuard } from './replay';
import {
  authorizeRequest,
  type DeviceStore,
  type RequestAuthorization,
  type RequestRejection,
} from './security';
import { BRIDGE_PROTOCOL_VERSION, opaqueIdSchema, sessionListBodySchema } from './schemas';
import type { SessionHandleRegistry } from './session-handles';

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
    mutationLimit: z.number().int().min(1).max(10_000).default(10),
    windowMs: z.number().int().min(1_000).max(60 * 60 * 1_000).default(60_000),
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

export interface SessionDiscoveryAdapter {
  isSessionListSupported(): boolean;
  listSessions(input?: unknown): Promise<AcpSessionPage>;
}

export interface BridgeServiceOptions {
  bridgeId: string;
  devices: DeviceStore;
  replayGuard: ReplayGuard;
  rateLimiter: RateLimiter;
  sessionHandles: SessionHandleRegistry;
  sessions: SessionDiscoveryAdapter;
  peerLimit?: number;
  healthLimit?: number;
  sessionListLimit?: number;
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

export class BridgeService {
  private readonly bridgeId: string;
  private readonly rates: z.infer<typeof serviceOptionsSchema>;
  private listing = false;

  constructor(private readonly dependencies: BridgeServiceOptions) {
    this.bridgeId = opaqueIdSchema.parse(dependencies.bridgeId);
    this.rates = serviceOptionsSchema.parse({
      peerLimit: dependencies.peerLimit,
      healthLimit: dependencies.healthLimit,
      sessionListLimit: dependencies.sessionListLimit,
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
            sessionLoad: false,
            sessionPrompt: false,
          },
        }),
      };
    }
    if (authorization.request.method === 'session.list') {
      return this.listSessions(authorization, context.now);
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
      const mayReadTitles = authorization.request.device.permissions.includes(
        'session:content:read',
      );
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
}
