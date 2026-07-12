import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import { z, type ZodType } from 'zod';

import { sessionIdSchema, sessionListBodySchema } from './schemas';

const ACP_PROTOCOL_VERSION = 1 as const;

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_PROMPT_TIMEOUT_MS = 30 * 60_000;
const MAX_JSON_RPC_BYTES = 1024 * 1024;
const MAX_UNMATCHED_MESSAGES = 100;
const MAX_CACHED_SESSIONS = 10_000;
const MAX_REPLAY_NOTIFICATIONS = 10_000;
const MAX_REPLAY_MESSAGES = 200;
const MAX_REPLAY_TEXT_BYTES = 160 * 1024;
const MAX_MESSAGE_TEXT_BYTES = 100 * 1024;
const SAFE_ENVIRONMENT_KEYS = [
  'HOME',
  'LANG',
  'LC_ALL',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TMPDIR',
  'USER',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
] as const;

const acpClientOptionsSchema = z
  .object({
    executablePath: z.string().min(1).max(4096).refine(isAbsolute, 'CLI path must be absolute'),
    requestTimeoutMs: z.number().int().min(50).max(30_000).default(DEFAULT_REQUEST_TIMEOUT_MS),
    promptTimeoutMs: z
      .number()
      .int()
      .min(1_000)
      .max(60 * 60_000)
      .default(DEFAULT_PROMPT_TIMEOUT_MS),
  })
  .strict();

const jsonRpcMessageSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number().int()]).optional(),
    result: z.unknown().optional(),
    error: z
      .object({
        code: z.number().int(),
        message: z.string().optional(),
      })
      .passthrough()
      .optional(),
    method: z.string().optional(),
    params: z.unknown().optional(),
  })
  .passthrough();

const initializeResultSchema = z
  .object({
    protocolVersion: z.literal(ACP_PROTOCOL_VERSION),
    agentCapabilities: z.record(z.unknown()),
    agentInfo: z
      .object({
        name: z.string().max(160).optional(),
        version: z.string().max(160).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const closeSessionResultSchema = z.object({}).passthrough();

const absolutePathSchema = z.string().min(1).max(4096).refine(isAbsolute, 'Path must be absolute');

const acpSessionInfoSchema = z
  .object({
    sessionId: z.string().min(1).max(512),
    cwd: absolutePathSchema,
    additionalDirectories: z.array(absolutePathSchema).max(64).optional(),
    title: z.string().max(10_000).optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
    _meta: z.record(z.unknown()).optional(),
  })
  .passthrough();

const listSessionsResultSchema = z
  .object({
    sessions: z.array(acpSessionInfoSchema).max(5_000),
    nextCursor: z.string().min(1).max(4096).optional(),
  })
  .passthrough()
  .superRefine((value, context) => {
    const ids = value.sessions.map((session) => session.sessionId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Session IDs must be unique' });
    }
  });

const loadSessionResultSchema = z.union([
  z.null(),
  z
    .object({
      modes: z.unknown().nullable().optional(),
      configOptions: z.array(z.unknown()).max(1_000).nullable().optional(),
      _meta: z.record(z.unknown()).nullable().optional(),
    })
    .passthrough(),
]);

const newSessionResultSchema = z
  .object({
    sessionId: sessionIdSchema,
    modes: z.unknown().nullable().optional(),
    configOptions: z.array(z.unknown()).max(1_000).nullable().optional(),
    _meta: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const selectConfigOptionSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
    category: z.string().max(80).optional(),
    type: z.literal('select'),
    currentValue: z.string().max(160),
    options: z
      .array(
        z
          .object({
            value: z.string().min(1).max(160),
            name: z.string().min(1).max(160),
            description: z.string().min(1).max(500).optional(),
            _meta: z.record(z.unknown()).optional(),
          })
          .passthrough(),
      )
      .max(200),
  })
  .passthrough();

const setConfigOptionResultSchema = z
  .object({ configOptions: z.array(z.unknown()).max(1_000) })
  .passthrough();

const promptResponseSchema = z
  .object({
    stopReason: z.enum(['end_turn', 'max_tokens', 'max_turn_requests', 'refusal', 'cancelled']),
  })
  .passthrough();

const sessionUpdateNotificationSchema = z
  .object({
    sessionId: sessionIdSchema,
    update: z
      .object({
        sessionUpdate: z.string().min(1).max(128),
      })
      .passthrough(),
    _meta: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const textReplayUpdateSchema = z
  .object({
    sessionUpdate: z.enum(['user_message_chunk', 'agent_message_chunk']),
    messageId: z.string().min(1).max(512).nullable().optional(),
    content: z
      .object({
        type: z.literal('text'),
        text: z.string().max(MAX_JSON_RPC_BYTES),
      })
      .passthrough(),
    _meta: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

export interface AcpClientOptions {
  executablePath: string;
  requestTimeoutMs?: number;
  promptTimeoutMs?: number;
}

export interface AcpSessionMetadata {
  sessionId: string;
  cwd: string;
  additionalDirectories?: string[];
  title?: string;
  updatedAt?: string;
  modelId?: string;
}

export interface AcpSessionPage {
  sessions: AcpSessionMetadata[];
  nextCursor?: string;
}

export interface AcpHistoryMessage {
  source: 'user' | 'devin';
  text: string;
}

export interface AcpLoadedSession {
  sessionId: string;
  cwd: string;
  messages: AcpHistoryMessage[];
  truncated: boolean;
  modelId?: string;
}

export type AcpModelBadge = 'new' | 'free_promo';

export interface AcpModelOption {
  id: string;
  name: string;
  description?: string;
  supportsImages?: boolean;
  badge?: AcpModelBadge;
}

export interface AcpModelCatalog {
  defaultModelId: string;
  models: AcpModelOption[];
}

interface AcpModelSelector {
  configId: string;
  catalog: AcpModelCatalog;
}

export type AcpOperationFailureKind = 'session_in_use' | 'request_failed';

export class AcpOperationError extends Error {
  constructor(
    readonly kind: AcpOperationFailureKind,
    operation: string,
    readonly code: number,
  ) {
    super(`ACP ${operation} failed`);
    this.name = 'AcpOperationError';
  }
}

export function isAcpSessionInUseError(error: unknown): boolean {
  return error instanceof AcpOperationError && error.kind === 'session_in_use';
}

interface CachedSessionMetadata {
  cwd: string;
}

interface CollectedReplayMessage extends AcpHistoryMessage {
  messageId?: string;
}

interface ReplayCollector {
  sessionId: string;
  notifications: number;
  messages: CollectedReplayMessage[];
  textBytes: number;
  truncated: boolean;
  accepting: boolean;
  failed: boolean;
  mergeBarrier: boolean;
}

interface PendingRequest {
  operation: string;
  schema: ZodType<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function safeChildEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    NO_COLOR: '1',
  };
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }
  return environment;
}

function supportsSessionList(agentCapabilities: Record<string, unknown>): boolean {
  const sessionCapabilities = agentCapabilities.sessionCapabilities;
  if (
    !sessionCapabilities ||
    typeof sessionCapabilities !== 'object' ||
    Array.isArray(sessionCapabilities)
  ) {
    return false;
  }
  const list = (sessionCapabilities as Record<string, unknown>).list;
  return Boolean(list) && typeof list === 'object' && !Array.isArray(list);
}

function supportsSessionLoad(agentCapabilities: Record<string, unknown>): boolean {
  return agentCapabilities.loadSession === true;
}

function trustedModelBadge(meta: Record<string, unknown> | undefined): AcpModelBadge | undefined {
  const badge = meta?.['cognition.ai/badge'];
  return badge === 'new' || badge === 'free_promo' ? badge : undefined;
}

function parseAcpModelSelector(
  configOptions: unknown[] | null | undefined,
): AcpModelSelector | null {
  const modelConfig = configOptions
    ?.map((option) => selectConfigOptionSchema.safeParse(option))
    .find(
      (option) =>
        option.success && (option.data.category === 'model' || option.data.id === 'model'),
    );
  if (!modelConfig?.success) return null;
  const ids = modelConfig.data.options.map((candidate) => candidate.value);
  if (new Set(ids).size !== ids.length) throw new Error('ACP model catalog contains duplicate IDs');
  if (!ids.includes(modelConfig.data.currentValue)) {
    throw new Error('ACP model catalog default is unavailable');
  }
  return {
    configId: modelConfig.data.id,
    catalog: {
      defaultModelId: modelConfig.data.currentValue,
      models: modelConfig.data.options.map((candidate) => ({
        id: candidate.value,
        name: candidate.name,
        ...(candidate.description ? { description: candidate.description } : {}),
        ...(typeof candidate._meta?.['cognition.ai/supportsImages'] === 'boolean'
          ? { supportsImages: candidate._meta['cognition.ai/supportsImages'] }
          : {}),
        ...(trustedModelBadge(candidate._meta)
          ? { badge: trustedModelBadge(candidate._meta) }
          : {}),
      })),
    },
  };
}

export function parseAcpModelCatalog(
  configOptions: unknown[] | null | undefined,
): AcpModelCatalog | null {
  return parseAcpModelSelector(configOptions)?.catalog ?? null;
}

function cloneModelCatalog(catalog: AcpModelCatalog): AcpModelCatalog {
  return { defaultModelId: catalog.defaultModelId, models: catalog.models.map((model) => ({ ...model })) };
}

function utf8Tail(value: string, maximumBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(value, 'utf8');
  try {
    if (bytes.length <= maximumBytes) return { text: value, truncated: false };
    let text = bytes.subarray(bytes.length - maximumBytes).toString('utf8');
    while (text.startsWith('\uFFFD')) text = text.slice(1);
    return { text, truncated: true };
  } finally {
    bytes.fill(0);
  }
}

function messageBytes(message: AcpHistoryMessage): number {
  return Buffer.byteLength(message.text, 'utf8');
}

export class AcpSessionClient {
  private readonly options: z.infer<typeof acpClientOptionsSchema>;
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private decoder = new StringDecoder('utf8');
  private nextRequestId = 1;
  private unmatchedMessages = 0;
  private readonly pending = new Map<string | number, PendingRequest>();
  private canListSessions = false;
  private canLoadSessions = false;
  private canEmbedContext = false;
  private canCloseSessions = false;
  private readonly listedSessions = new Map<string, CachedSessionMetadata>();
  private readonly loadedSessions = new Set<string>();
  private activeLoad: ReplayCollector | null = null;
  private activePromptSessionId: string | null = null;
  private creatingContinuation = false;
  private modelCatalog: AcpModelCatalog | null = null;
  private readonly sessionModelSelectors = new Map<string, AcpModelSelector>();

  constructor(options: AcpClientOptions) {
    this.options = acpClientOptionsSchema.parse(options);
  }

  async start(): Promise<void> {
    if (this.child) throw new Error('ACP client is already started');
    const environment = safeChildEnvironment();
    const workingDirectory = environment.HOME;
    if (!workingDirectory || !isAbsolute(workingDirectory)) {
      throw new Error('ACP client requires an absolute home directory');
    }
    this.buffer = '';
    this.decoder = new StringDecoder('utf8');
    this.unmatchedMessages = 0;
    this.listedSessions.clear();
    this.loadedSessions.clear();
    this.activeLoad = null;
    this.activePromptSessionId = null;
    this.creatingContinuation = false;
    this.modelCatalog = null;
    this.sessionModelSelectors.clear();
    this.canListSessions = false;
    this.canLoadSessions = false;
    this.canEmbedContext = false;
    this.canCloseSessions = false;
    const child = spawn(this.options.executablePath, ['acp'], {
      cwd: workingDirectory,
      env: environment,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    child.stderr.resume();
    child.stdout.on('data', (chunk: Buffer) => this.handleData(child, chunk));
    child.stdin.on('error', () => this.abort(child, new Error('ACP input stream closed')));
    child.on('error', () => this.abort(child, new Error('ACP process could not be started')));
    child.on('close', () => this.handleClose(child));

    try {
      const initialization = await this.request(
        'initialize',
        {
          protocolVersion: ACP_PROTOCOL_VERSION,
          clientCapabilities: {},
          clientInfo: { name: 'devinx-desktop-bridge', version: '1' },
        },
        initializeResultSchema,
        'initialization',
      );
      this.canListSessions = supportsSessionList(initialization.agentCapabilities);
      this.canLoadSessions = supportsSessionLoad(initialization.agentCapabilities);
      this.canEmbedContext =
        (
          initialization.agentCapabilities.promptCapabilities as
            | Record<string, unknown>
            | undefined
        )?.embeddedContext === true;
      this.canCloseSessions = Boolean(
        (
          initialization.agentCapabilities.sessionCapabilities as
            | Record<string, unknown>
            | undefined
        )?.close,
      );
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async listSessions(input: unknown = {}): Promise<AcpSessionPage> {
    if (!this.child) throw new Error('ACP client is not started');
    if (!this.canListSessions) throw new Error('ACP agent does not support session listing');
    const request = sessionListBodySchema.parse(input);
    const result = await this.request(
      'session/list',
      request.cursor ? { cursor: request.cursor } : {},
      listSessionsResultSchema,
      'session list',
    );
    const newSessionIds = result.sessions.filter(
      (session) => !this.listedSessions.has(session.sessionId),
    );
    if (this.listedSessions.size + newSessionIds.length > MAX_CACHED_SESSIONS) {
      throw new Error('ACP listed session cache capacity reached');
    }
    for (const session of result.sessions) {
      this.listedSessions.set(session.sessionId, { cwd: session.cwd });
    }
    return {
      sessions: result.sessions.map((session) => ({
        sessionId: session.sessionId,
        cwd: session.cwd,
        additionalDirectories: session.additionalDirectories
          ? [...session.additionalDirectories]
          : undefined,
        title: session.title,
        updatedAt: session.updatedAt,
      })),
      nextCursor: result.nextCursor,
    };
  }

  isSessionListSupported(): boolean {
    return Boolean(this.child) && this.canListSessions;
  }

  isSessionLoadSupported(): boolean {
    return Boolean(this.child) && this.canLoadSessions;
  }

  isSessionPromptSupported(): boolean {
    return Boolean(this.child);
  }

  isSessionCreateSupported(): boolean {
    return Boolean(this.child);
  }

  async listModelCatalog(): Promise<AcpModelCatalog> {
    if (!this.child) throw new Error('ACP client is not started');
    if (this.modelCatalog) return cloneModelCatalog(this.modelCatalog);
    if (!this.canListSessions || !this.canLoadSessions) {
      throw new Error('ACP agent does not support model discovery');
    }
    if (this.activeLoad || this.activePromptSessionId || this.creatingContinuation) {
      throw new Error('ACP model discovery is busy');
    }
    let cursor: string | undefined;
    let attempts = 0;
    while (attempts < 20) {
      const page = await this.listSessions(cursor ? { cursor } : {});
      for (const session of page.sessions) {
        if (attempts >= 20) break;
        attempts += 1;
        try {
          await this.loadSession(session.sessionId);
          if (this.modelCatalog) {
            const catalog = cloneModelCatalog(this.modelCatalog);
            await this.releaseSessionOwnership(session.sessionId);
            return catalog;
          }
        } catch (error) {
          if (!isAcpSessionInUseError(error)) continue;
        }
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    throw new Error('ACP model catalog is unavailable');
  }

  async loadSession(input: unknown): Promise<AcpLoadedSession> {
    if (!this.child) throw new Error('ACP client is not started');
    if (!this.canLoadSessions) throw new Error('ACP agent does not support session loading');
    if (this.activeLoad) throw new Error('ACP session loading is busy');
    if (this.activePromptSessionId) throw new Error('ACP session prompting is busy');
    const sessionId = sessionIdSchema.parse(input);
    const metadata = this.listedSessions.get(sessionId);
    if (!metadata) throw new Error('ACP session must be listed before loading');

    const collector: ReplayCollector = {
      sessionId,
      notifications: 0,
      messages: [],
      textBytes: 0,
      truncated: false,
      accepting: true,
      failed: false,
      mergeBarrier: false,
    };
    this.activeLoad = collector;
    try {
      const loaded = await this.request(
        'session/load',
        { sessionId, cwd: metadata.cwd, mcpServers: [] },
        loadSessionResultSchema,
        'session load',
      );
      if (loaded) {
        const selector = parseAcpModelSelector(loaded.configOptions);
        if (selector) {
          this.modelCatalog = selector.catalog;
          this.sessionModelSelectors.set(sessionId, selector);
        }
      }
      collector.accepting = false;
      if (collector.failed) throw new Error('ACP session replay failed validation');
      this.loadedSessions.add(sessionId);
      return {
        sessionId,
        cwd: metadata.cwd,
        messages: collector.messages.map(({ source, text }) => ({ source, text })),
        truncated: collector.truncated,
        modelId: this.sessionModelSelectors.get(sessionId)?.catalog.defaultModelId,
      };
    } finally {
      if (this.activeLoad === collector) this.activeLoad = null;
    }
  }

  async promptSession(
    sessionIdInput: unknown,
    textInput: unknown,
    modelInput?: unknown,
  ): Promise<void> {
    if (!this.child) throw new Error('ACP client is not started');
    const sessionId = sessionIdSchema.parse(sessionIdInput);
    const text = z.string().trim().min(1).max(100_000).parse(textInput);
    if (!this.loadedSessions.has(sessionId)) {
      throw new Error('ACP session must be loaded before prompting');
    }
    if (modelInput !== undefined) await this.selectSessionModel(sessionId, modelInput);
    this.startPrompt(sessionId, [{ type: 'text', text }]);
  }

  async createContinuation(
    cwdInput: unknown,
    contextInput: unknown,
    textInput: unknown,
    modelInput?: unknown,
  ): Promise<string> {
    if (!this.child) throw new Error('ACP client is not started');
    if (!this.canEmbedContext) throw new Error('ACP agent does not support embedded context');
    const cwd = absolutePathSchema.parse(cwdInput);
    const context = z.string().min(1).max(160 * 1024).parse(contextInput);
    const text = z.string().trim().min(1).max(100_000).parse(textInput);
    if (this.activeLoad || this.activePromptSessionId || this.creatingContinuation) {
      throw new Error('ACP session continuation is busy');
    }
    this.creatingContinuation = true;
    try {
      const created = await this.request(
        'session/new',
        { cwd, mcpServers: [] },
        newSessionResultSchema,
        'session creation',
      );
      if (this.listedSessions.size >= MAX_CACHED_SESSIONS) {
        throw new Error('ACP listed session cache capacity reached');
      }
      this.listedSessions.set(created.sessionId, { cwd });
      this.loadedSessions.add(created.sessionId);
      const selector = parseAcpModelSelector(created.configOptions);
      if (selector) {
        this.modelCatalog = selector.catalog;
        this.sessionModelSelectors.set(created.sessionId, selector);
      }
      if (modelInput !== undefined) {
        await this.selectSessionModel(created.sessionId, modelInput);
      }
      this.startPrompt(created.sessionId, [
        {
          type: 'resource',
          resource: {
            uri: 'devinx://continuation/history.md',
            mimeType: 'text/markdown',
            text: context,
          },
        },
        { type: 'text', text },
      ]);
      return created.sessionId;
    } finally {
      this.creatingContinuation = false;
    }
  }

  async createSession(cwdInput: unknown, modelInput: unknown, textInput: unknown): Promise<string> {
    if (!this.child) throw new Error('ACP client is not started');
    const cwd = absolutePathSchema.parse(cwdInput);
    const modelId = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:+-]+$/).nullable().parse(
      modelInput,
    );
    const text = z.string().trim().min(1).max(100_000).parse(textInput);
    if (this.activeLoad || this.activePromptSessionId || this.creatingContinuation) {
      throw new Error('ACP session creation is busy');
    }
    this.creatingContinuation = true;
    try {
      const created = await this.request(
        'session/new',
        { cwd, mcpServers: [] },
        newSessionResultSchema,
        'session creation',
      );
      const selector = parseAcpModelSelector(created.configOptions);
      if (selector) {
        this.modelCatalog = selector.catalog;
        this.sessionModelSelectors.set(created.sessionId, selector);
      }
      if (modelId) {
        await this.selectSessionModel(created.sessionId, modelId);
      }
      if (this.listedSessions.size >= MAX_CACHED_SESSIONS) {
        throw new Error('ACP listed session cache capacity reached');
      }
      this.listedSessions.set(created.sessionId, { cwd });
      this.loadedSessions.add(created.sessionId);
      this.startPrompt(created.sessionId, [{ type: 'text', text }]);
      return created.sessionId;
    } finally {
      this.creatingContinuation = false;
    }
  }

  async releaseSessionOwnership(sessionIdInput: unknown): Promise<void> {
    const sessionId = sessionIdSchema.parse(sessionIdInput);
    if (!this.loadedSessions.has(sessionId)) return;
    if (!this.child) {
      this.loadedSessions.delete(sessionId);
      this.sessionModelSelectors.delete(sessionId);
      return;
    }
    if (this.canCloseSessions) {
      try {
        await this.request(
          'session/close',
          { sessionId },
          closeSessionResultSchema,
          'session close',
        );
        this.loadedSessions.delete(sessionId);
        this.sessionModelSelectors.delete(sessionId);
        return;
      } catch {
        // A declared but failed close must not leave a Connector-owned lock behind.
      }
    }
    const listedSessions = [...this.listedSessions.entries()];
    const modelCatalog = this.modelCatalog ? cloneModelCatalog(this.modelCatalog) : null;
    await this.stop();
    await this.start();
    for (const [listedSessionId, metadata] of listedSessions) {
      this.listedSessions.set(listedSessionId, { ...metadata });
    }
    this.modelCatalog = modelCatalog;
  }

  private async selectSessionModel(sessionId: string, modelInput: unknown): Promise<void> {
    const modelId = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:+-]+$/).parse(modelInput);
    const selector = this.sessionModelSelectors.get(sessionId);
    if (!selector?.catalog.models.some((model) => model.id === modelId)) {
      throw new Error('ACP model is not available');
    }
    const result = await this.request(
      'session/set_config_option',
      { sessionId, configId: selector.configId, value: modelId },
      setConfigOptionResultSchema,
      'model selection',
    );
    const updated = parseAcpModelSelector(result.configOptions);
    if (!updated || updated.catalog.defaultModelId !== modelId) {
      throw new Error('ACP model selection was not confirmed');
    }
    this.sessionModelSelectors.set(sessionId, updated);
    this.modelCatalog = updated.catalog;
  }

  private startPrompt(sessionId: string, prompt: unknown[]): void {
    if (this.activeLoad || this.activePromptSessionId) {
      throw new Error('ACP session prompting is busy');
    }
    this.activePromptSessionId = sessionId;
    this.request(
      'session/prompt',
      { sessionId, prompt },
      promptResponseSchema,
      'session prompt',
      this.options.promptTimeoutMs,
    ).then(
      () => this.finishPrompt(sessionId),
      () => this.finishPrompt(sessionId),
    );
  }

  private async finishPrompt(sessionId: string): Promise<void> {
    if (this.activePromptSessionId === sessionId) this.activePromptSessionId = null;
    await this.releaseSessionOwnership(sessionId).catch(() => this.stop().catch(() => {}));
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.canListSessions = false;
    this.canLoadSessions = false;
    this.canEmbedContext = false;
    this.canCloseSessions = false;
    this.listedSessions.clear();
    this.loadedSessions.clear();
    this.sessionModelSelectors.clear();
    this.activeLoad = null;
    this.activePromptSessionId = null;
    this.creatingContinuation = false;
    this.buffer = '';
    this.decoder = new StringDecoder('utf8');
    this.unmatchedMessages = 0;
    this.rejectPending(new Error('ACP client stopped'));
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    await new Promise<void>((resolve) => {
      let complete = false;
      const finish = () => {
        if (complete) return;
        complete = true;
        clearTimeout(forceTimer);
        resolve();
      };
      const forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 250);
      child.once('close', finish);
      child.kill('SIGTERM');
    });
  }

  private request<T>(
    method: string,
    params: unknown,
    schema: ZodType<T>,
    operation: string,
    timeoutMs = this.options.requestTimeoutMs,
  ): Promise<T> {
    const child = this.child;
    if (!child) return Promise.reject(new Error('ACP client is not started'));
    const id = this.nextRequestId;
    this.nextRequestId += 1;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(`ACP ${operation} timed out`);
        reject(error);
        this.abort(child, error);
      }, timeoutMs);
      timer.unref();
      this.pending.set(id, {
        operation,
        schema: schema as ZodType<unknown>,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  private handleData(child: ChildProcessWithoutNullStreams, chunk: Buffer): void {
    if (child !== this.child) return;
    this.buffer += this.decoder.write(chunk);
    if (
      Buffer.byteLength(this.buffer, 'utf8') > MAX_JSON_RPC_BYTES &&
      !this.buffer.includes('\n')
    ) {
      this.abort(child, new Error('ACP message exceeded the size limit'));
      return;
    }

    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      if (Buffer.byteLength(line, 'utf8') > MAX_JSON_RPC_BYTES) {
        this.abort(child, new Error('ACP message exceeded the size limit'));
        return;
      }
      this.handleLine(child, line);
      if (child !== this.child) return;
    }
  }

  private handleLine(child: ChildProcessWithoutNullStreams, line: string): void {
    let decoded: unknown;
    try {
      decoded = JSON.parse(line);
    } catch {
      this.abort(child, new Error('ACP returned invalid JSON-RPC'));
      return;
    }
    const messageResult = jsonRpcMessageSchema.safeParse(decoded);
    if (!messageResult.success) {
      this.abort(child, new Error('ACP returned invalid JSON-RPC'));
      return;
    }
    const message = messageResult.data;
    if (message.method === 'session/update' && message.id === undefined) {
      this.handleSessionUpdate(child, message.params);
      return;
    }
    if (message.method && message.id !== undefined) {
      this.abort(child, new Error('ACP agent requests are not supported'));
      return;
    }
    if (message.id === undefined || !this.pending.has(message.id)) {
      this.unmatchedMessages += 1;
      if (this.unmatchedMessages > MAX_UNMATCHED_MESSAGES) {
        this.abort(child, new Error('ACP returned too many unsolicited messages'));
      }
      return;
    }

    this.unmatchedMessages = 0;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      const kind: AcpOperationFailureKind =
        message.error.code === -32600 &&
        /already open in another process/i.test(message.error.message ?? '')
          ? 'session_in_use'
          : 'request_failed';
      pending.reject(new AcpOperationError(kind, pending.operation, message.error.code));
      return;
    }
    const result = pending.schema.safeParse(message.result);
    if (!result.success) {
      const error = new Error(`ACP ${pending.operation} response failed validation`);
      pending.reject(error);
      this.abort(child, error);
      return;
    }
    pending.resolve(result.data);
  }

  private handleSessionUpdate(child: ChildProcessWithoutNullStreams, input: unknown): void {
    const collector = this.activeLoad;
    if (!collector && this.activePromptSessionId) {
      const result = sessionUpdateNotificationSchema.safeParse(input);
      if (!result.success || result.data.sessionId !== this.activePromptSessionId) {
        this.abort(child, new Error('ACP prompt update failed validation'));
      }
      return;
    }
    if (!collector || !collector.accepting) {
      this.unmatchedMessages += 1;
      if (this.unmatchedMessages > MAX_UNMATCHED_MESSAGES) {
        this.abort(child, new Error('ACP returned too many unsolicited messages'));
      }
      return;
    }
    collector.notifications += 1;
    if (collector.notifications > MAX_REPLAY_NOTIFICATIONS) {
      collector.truncated = true;
      collector.mergeBarrier = true;
      return;
    }
    const notificationResult = sessionUpdateNotificationSchema.safeParse(input);
    if (!notificationResult.success || notificationResult.data.sessionId !== collector.sessionId) {
      // Drop invalid or differently-associated records without collecting any
      // of their content or terminating otherwise valid replay history.
      collector.truncated = true;
      collector.mergeBarrier = true;
      return;
    }
    const updateType = notificationResult.data.update.sessionUpdate;
    if (updateType !== 'user_message_chunk' && updateType !== 'agent_message_chunk') {
      // Devin ACP currently omits messageId on replay. Private thought/tool
      // events still form a trustworthy boundary between otherwise adjacent
      // same-author messages, even though their content must never be exposed.
      collector.mergeBarrier = true;
      return;
    }
    const contentType = (notificationResult.data.update.content as { type?: unknown } | undefined)
      ?.type;
    if (contentType !== 'text') {
      collector.mergeBarrier = true;
      return;
    }
    const updateResult = textReplayUpdateSchema.safeParse(notificationResult.data.update);
    if (!updateResult.success) {
      collector.truncated = true;
      collector.mergeBarrier = true;
      return;
    }
    this.collectReplayText(collector, {
      source: updateResult.data.sessionUpdate === 'user_message_chunk' ? 'user' : 'devin',
      text: updateResult.data.content.text,
      messageId: updateResult.data.messageId ?? undefined,
    });
  }

  private collectReplayText(collector: ReplayCollector, input: CollectedReplayMessage): void {
    if (input.text.length === 0) return;
    const clipped = utf8Tail(input.text, MAX_MESSAGE_TEXT_BYTES);
    collector.truncated ||= clipped.truncated;
    const last = collector.messages.at(-1);
    const shouldMerge =
      last?.source === input.source &&
      ((last.messageId !== undefined && last.messageId === input.messageId) ||
        (last.messageId === undefined &&
          input.messageId === undefined &&
          !collector.mergeBarrier));
    if (shouldMerge && last) {
      collector.textBytes -= messageBytes(last);
      const merged = utf8Tail(`${last.text}${clipped.text}`, MAX_MESSAGE_TEXT_BYTES);
      last.text = merged.text;
      collector.truncated ||= merged.truncated;
      collector.textBytes += messageBytes(last);
    } else {
      const message: CollectedReplayMessage = {
        source: input.source,
        text: clipped.text,
        messageId: input.messageId,
      };
      collector.messages.push(message);
      collector.textBytes += messageBytes(message);
    }
    collector.mergeBarrier = false;
    while (
      collector.messages.length > MAX_REPLAY_MESSAGES ||
      collector.textBytes > MAX_REPLAY_TEXT_BYTES
    ) {
      const removed = collector.messages.shift();
      if (!removed) break;
      collector.textBytes -= messageBytes(removed);
      collector.truncated = true;
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private abort(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (child !== this.child) return;
    this.child = null;
    this.canListSessions = false;
    this.canLoadSessions = false;
    this.canEmbedContext = false;
    this.canCloseSessions = false;
    this.listedSessions.clear();
    this.loadedSessions.clear();
    if (this.activeLoad) this.activeLoad.failed = true;
    this.activeLoad = null;
    this.activePromptSessionId = null;
    this.creatingContinuation = false;
    this.buffer = '';
    this.decoder = new StringDecoder('utf8');
    this.unmatchedMessages = 0;
    this.rejectPending(error);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 250);
      forceTimer.unref();
    }
  }

  private handleClose(child: ChildProcessWithoutNullStreams): void {
    if (child !== this.child) return;
    this.child = null;
    this.canListSessions = false;
    this.canLoadSessions = false;
    this.canEmbedContext = false;
    this.canCloseSessions = false;
    this.listedSessions.clear();
    this.loadedSessions.clear();
    if (this.activeLoad) this.activeLoad.failed = true;
    this.activeLoad = null;
    this.activePromptSessionId = null;
    this.creatingContinuation = false;
    this.buffer = '';
    this.decoder = new StringDecoder('utf8');
    this.unmatchedMessages = 0;
    this.rejectPending(new Error('ACP process exited'));
  }
}
