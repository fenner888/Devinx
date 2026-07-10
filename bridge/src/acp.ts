import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import { z, type ZodType } from 'zod';

import { BRIDGE_PROTOCOL_VERSION, sessionListBodySchema } from './schemas';

const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const MAX_JSON_RPC_BYTES = 1024 * 1024;
const MAX_UNMATCHED_MESSAGES = 100;
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
    protocolVersion: z.literal(BRIDGE_PROTOCOL_VERSION),
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

export interface AcpClientOptions {
  executablePath: string;
  requestTimeoutMs?: number;
}

export interface AcpSessionMetadata {
  sessionId: string;
  cwd: string;
  additionalDirectories?: string[];
  title?: string;
  updatedAt?: string;
}

export interface AcpSessionPage {
  sessions: AcpSessionMetadata[];
  nextCursor?: string;
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
  if (!sessionCapabilities || typeof sessionCapabilities !== 'object' || Array.isArray(sessionCapabilities)) {
    return false;
  }
  const list = (sessionCapabilities as Record<string, unknown>).list;
  return Boolean(list) && typeof list === 'object' && !Array.isArray(list);
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
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          clientCapabilities: {},
          clientInfo: { name: 'devinx-desktop-bridge', version: '1' },
        },
        initializeResultSchema,
        'initialization',
      );
      this.canListSessions = supportsSessionList(initialization.agentCapabilities);
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

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.canListSessions = false;
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
      }, this.options.requestTimeoutMs);
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
    if (Buffer.byteLength(this.buffer, 'utf8') > MAX_JSON_RPC_BYTES && !this.buffer.includes('\n')) {
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
      pending.reject(new Error(`ACP ${pending.operation} failed with code ${message.error.code}`));
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
    this.buffer = '';
    this.decoder = new StringDecoder('utf8');
    this.unmatchedMessages = 0;
    this.rejectPending(new Error('ACP process exited'));
  }
}
