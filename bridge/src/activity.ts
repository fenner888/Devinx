import { createHash } from 'node:crypto';
import { basename, isAbsolute, relative, sep, win32 } from 'node:path';

import { z } from 'zod';

import { utf8Tail } from './text';

export type ActivityToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'other';
export type ActivityStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'interrupted'
  | 'unknown'
  | 'awaiting_input'
  | 'timed_out';
export type ActivityDetail =
  | { type: 'text'; text: string }
  | { type: 'diff'; path: string; oldText?: string; newText?: string };
export interface ActivityEntry {
  id: string;
  afterSequence: number;
  kind: 'thought' | 'tool';
  toolKind?: ActivityToolKind;
  status: ActivityStatus;
  title: string;
  paths?: string[];
  detail?: ActivityDetail;
  truncated: boolean;
  startedAt?: number;
  endedAt?: number;
}

export const ACTIVITY_LIMITS = {
  entries: 500,
  detailBytes: 16 * 1024,
  totalDetailBytes: 160 * 1024,
  paths: 20,
  pathLength: 512,
  title: 200,
} as const;

const activityPathSchema = z
  .string()
  .min(1)
  .max(ACTIVITY_LIMITS.pathLength)
  .refine(
    (value) =>
      !isAbsolute(value) &&
      !win32.isAbsolute(value) &&
      !value.startsWith('~') &&
      !value.replace(/\\/g, '/').split('/').includes('..'),
    'Path must be workspace-relative',
  );

const activityDetailSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('text'),
      text: z
        .string()
        .max(1024 * 1024)
        .refine((value) => Buffer.byteLength(value, 'utf8') <= ACTIVITY_LIMITS.detailBytes),
    })
    .strict(),
  z
    .object({
      type: z.literal('diff'),
      path: activityPathSchema,
      oldText: z
        .string()
        .max(1024 * 1024)
        .refine((value) => Buffer.byteLength(value, 'utf8') <= ACTIVITY_LIMITS.detailBytes)
        .optional(),
      newText: z
        .string()
        .max(1024 * 1024)
        .refine((value) => Buffer.byteLength(value, 'utf8') <= ACTIVITY_LIMITS.detailBytes)
        .optional(),
    })
    .strict(),
]);

export const activityEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    afterSequence: z.number().int().nonnegative(),
    kind: z.enum(['thought', 'tool']),
    toolKind: z
      .enum(['read', 'edit', 'delete', 'move', 'search', 'execute', 'think', 'fetch', 'other'])
      .optional(),
    status: z.enum([
      'running',
      'completed',
      'failed',
      'interrupted',
      'unknown',
      'awaiting_input',
      'timed_out',
    ]),
    title: z.string().min(1).max(ACTIVITY_LIMITS.title),
    paths: z.array(activityPathSchema).max(ACTIVITY_LIMITS.paths).optional(),
    detail: activityDetailSchema.optional(),
    truncated: z.boolean(),
    startedAt: z.number().int().nonnegative().optional(),
    endedAt: z.number().int().nonnegative().optional(),
  })
  .strict();

export function activityStatusFromAcp(status: string | undefined): ActivityStatus {
  const normalized = status?.toLowerCase();
  if (normalized === 'pending' || normalized === 'in_progress') return 'running';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'failed') return 'failed';
  return 'unknown';
}

export function legacyActivityStatus(status: ActivityStatus): ActivityStatus {
  if (status === 'awaiting_input') return 'running';
  if (status === 'timed_out') return 'failed';
  return status;
}

export function activityKindFromToolName(name: string): ActivityToolKind {
  const normalized = name.toLowerCase();
  if (normalized === 'read' || normalized === 'view') return 'read';
  if (
    normalized === 'edit' ||
    normalized === 'write' ||
    normalized === 'create' ||
    normalized === 'multi_edit'
  ) {
    return 'edit';
  }
  if (normalized === 'delete') return 'delete';
  if (normalized === 'move' || normalized === 'rename') return 'move';
  if (
    normalized === 'grep' ||
    normalized === 'glob' ||
    normalized === 'search' ||
    normalized === 'find'
  ) {
    return 'search';
  }
  if (
    normalized === 'exec' ||
    normalized === 'bash' ||
    normalized === 'shell' ||
    normalized === 'get_output' ||
    normalized === 'kill_shell'
  ) {
    return 'execute';
  }
  if (normalized === 'think') return 'think';
  if (
    normalized === 'webfetch' ||
    normalized === 'fetch' ||
    normalized === 'web_search'
  ) {
    return 'fetch';
  }
  return 'other';
}

const ACTIVITY_TOOL_KINDS = new Set<string>([
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'other',
]);

export function relativeActivityPath(path: string, cwd: string): string {
  if (typeof path !== 'string') return '';
  const clean = path.trim();
  if (!clean) return '';
  if (clean === '.') return '.';
  const safeFallback = (): string => {
    const base = (win32.isAbsolute(clean) ? win32.basename(clean) : basename(clean)).trim();
    if (!base || base === '.' || base.startsWith('~')) return '';
    return base;
  };
  const absoluteLike =
    isAbsolute(clean) || win32.isAbsolute(clean) || clean === '~' || clean.startsWith('~/');
  if (!absoluteLike) {
    const normalized = clean.replace(/\\/g, '/');
    if (normalized.split('/').includes('..')) return safeFallback();
    return normalized;
  }
  const relativePath = relative(cwd, clean);
  if (relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    const normalized = relativePath.split(sep).join('/');
    if (!normalized.split('/').includes('..') && !normalized.startsWith('~')) return normalized;
  }
  return safeFallback();
}

function detailByteLength(detail: ActivityDetail): number {
  if (detail.type === 'text') return Buffer.byteLength(detail.text, 'utf8');
  return (
    Buffer.byteLength(detail.path, 'utf8') +
    Buffer.byteLength(detail.oldText ?? '', 'utf8') +
    Buffer.byteLength(detail.newText ?? '', 'utf8')
  );
}

function cleanDetailText(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      if (codePoint === 9 || codePoint === 10) return character;
      return codePoint < 32 || codePoint === 127 ? ' ' : character;
    })
    .join('');
}

export function clipActivityDetail(
  detail: ActivityDetail,
  budgetBytes: number,
): { detail: ActivityDetail; truncated: boolean; bytes: number } {
  if (detail.type === 'text') {
    const clipped = utf8Tail(cleanDetailText(detail.text), budgetBytes);
    return { detail: { type: 'text', text: clipped.text }, truncated: clipped.truncated, bytes: Buffer.byteLength(clipped.text, 'utf8') };
  }
  const perField = Math.max(1, Math.floor(budgetBytes));
  const oldText = detail.oldText === undefined ? undefined : utf8Tail(detail.oldText, perField);
  const newText = detail.newText === undefined ? undefined : utf8Tail(detail.newText, perField);
  const clipped: ActivityDetail = {
    type: 'diff',
    path: detail.path,
    ...(detail.oldText === undefined ? {} : { oldText: oldText?.text ?? '' }),
    ...(detail.newText === undefined ? {} : { newText: newText?.text ?? '' }),
  };
  return {
    detail: clipped,
    truncated: Boolean(oldText?.truncated || newText?.truncated),
    bytes: detailByteLength(clipped),
  };
}

function cleanActivityTitle(value: string | undefined, fallback: string): string {
  const collapsed = [...(value ?? '')]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || codePoint === 127 ? ' ' : character;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const clean = [...collapsed].slice(0, ACTIVITY_LIMITS.title).join('');
  return clean || fallback;
}

const toolCallInputSchema = z
  .object({
    toolCallId: z.string().min(1).max(512),
    title: z.string().max(4_096).optional(),
    kind: z.string().max(80).optional(),
    status: z.string().max(80).optional(),
    content: z.array(z.unknown()).max(100).optional(),
    locations: z
      .array(
        z
          .object({ path: z.string().min(1).max(4_096) })
          .passthrough(),
      )
      .max(100)
      .optional(),
    _meta: z.record(z.unknown()).optional(),
  })
  .passthrough();

const toolUpdateInputSchema = z
  .object({
    status: z.string().max(80).optional(),
    content: z.array(z.unknown()).max(100).optional(),
    rawOutput: z.unknown().optional(),
    _meta: z.record(z.unknown()).optional(),
  })
  .passthrough();

const diffContentSchema = z
  .object({
    type: z.literal('diff'),
    path: z.string().min(1).max(4_096),
    oldText: z.string().max(2 * 1024 * 1024).optional(),
    newText: z.string().max(2 * 1024 * 1024).optional(),
  })
  .passthrough();

const wrapperContentSchema = z
  .object({
    type: z.literal('content'),
    content: z
      .object({
        type: z.string().max(80),
        text: z.string().max(2 * 1024 * 1024).optional(),
        resource: z
          .object({
            mimeType: z.string().max(200).optional(),
            text: z.string().max(2 * 1024 * 1024).optional(),
            uri: z.string().max(4_096).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

function toolEntryId(toolCallId: string): string {
  return `tool_${createHash('sha256').update(toolCallId, 'utf8').digest('hex').slice(0, 32)}`;
}

function inferenceToolName(meta: Record<string, unknown> | undefined): string | undefined {
  const value = meta?.['cognition.ai/inferenceToolName'];
  return typeof value === 'string' && value.length <= 80 ? value : undefined;
}

export interface ActivityLogOptions {
  // Wall-clock fallback for missing timestamps; disabled for replayed
  // history where only persisted times are meaningful.
  implicitTimestamps?: boolean;
}

export class ActivityLog {
  private readonly entries: ActivityEntry[] = [];
  private readonly toolsByCallId = new Map<string, ActivityEntry>();
  private openThought: ActivityEntry | null = null;
  private thoughtCounter = 0;
  private detailBytes = 0;
  private overflowed = false;
  private readonly implicitTimestamps: boolean;

  constructor(options: ActivityLogOptions = {}) {
    this.implicitTimestamps = options.implicitTimestamps ?? true;
  }

  private effectiveAt(at?: number): number | undefined {
    return at ?? (this.implicitTimestamps ? Date.now() : undefined);
  }

  get truncated(): boolean {
    return this.overflowed;
  }

  beginThought(afterSequence: number, text: string, at?: number): void {
    try {
      this.beginThoughtUnsafe(afterSequence, text, at);
    } catch {
      this.overflowed = true;
    }
  }

  beginTool(
    afterSequence: number,
    input: unknown,
    cwd: string,
    at?: number,
  ): void {
    try {
      this.beginToolUnsafe(afterSequence, input, cwd, at);
    } catch {
      this.overflowed = true;
    }
  }

  updateTool(toolCallId: string, input: unknown, at?: number): void {
    try {
      this.updateToolUnsafe(toolCallId, input, at);
    } catch {
      this.overflowed = true;
    }
  }

  markAwaitingInput(toolCallId: string): void {
    try {
      const callId = z.string().min(1).max(512).parse(toolCallId);
      const entry = this.toolsByCallId.get(callId);
      if (entry?.status === 'running') {
        entry.status = 'awaiting_input';
      }
    } catch {
      this.overflowed = true;
    }
  }

  resumeTool(toolCallId: string): void {
    try {
      const callId = z.string().min(1).max(512).parse(toolCallId);
      const entry = this.toolsByCallId.get(callId);
      if (entry?.status === 'awaiting_input') {
        entry.status = 'running';
        entry.endedAt = undefined;
      }
    } catch {
      this.overflowed = true;
    }
  }

  timeOutTool(toolCallId: string, at?: number): void {
    try {
      const callId = z.string().min(1).max(512).parse(toolCallId);
      const entry = this.toolsByCallId.get(callId);
      if (entry && (entry.status === 'running' || entry.status === 'awaiting_input')) {
        entry.status = 'timed_out';
        const ended = this.effectiveAt(at);
        if (ended !== undefined) entry.endedAt = ended;
      }
    } catch {
      this.overflowed = true;
    }
  }

  entryForToolCall(toolCallId: string): ActivityEntry | undefined {
    const entry = this.toolsByCallId.get(toolCallId);
    return entry
      ? {
          ...entry,
          ...(entry.paths ? { paths: [...entry.paths] } : {}),
          ...(entry.detail ? { detail: { ...entry.detail } } : {}),
        }
      : undefined;
  }

  interruptTool(toolCallId: string, at?: number): void {
    try {
      const callId = z.string().min(1).max(512).parse(toolCallId);
      const entry = this.toolsByCallId.get(callId);
      if (entry && (entry.status === 'running' || entry.status === 'awaiting_input')) {
        entry.status = 'interrupted';
        const ended = this.effectiveAt(at);
        if (ended !== undefined) entry.endedAt = ended;
      }
    } catch {
      this.overflowed = true;
    }
  }

  markTruncated(): void {
    this.overflowed = true;
  }

  closeThought(at?: number): void {
    this.closeOpenThought(at);
  }

  finishTurn(at?: number): void {
    const now = this.effectiveAt(at);
    if (this.openThought) {
      this.openThought.status = 'completed';
      if (now !== undefined) this.openThought.endedAt = now;
      this.openThought = null;
    }
    for (const entry of this.entries) {
      if (
        entry.kind === 'tool' &&
        (entry.status === 'running' || entry.status === 'awaiting_input')
      ) {
        entry.status = 'interrupted';
        if (now !== undefined) entry.endedAt = now;
      }
    }
  }

  list(): ActivityEntry[] {
    const validated: ActivityEntry[] = [];
    for (const entry of this.entries) {
      const parsed = activityEntrySchema.safeParse(entry);
      if (parsed.success) validated.push(parsed.data);
      else this.overflowed = true;
    }
    return validated;
  }

  private closeOpenThought(at?: number): void {
    if (!this.openThought) return;
    this.openThought.status = 'completed';
    if (at !== undefined) this.openThought.endedAt = at;
    this.openThought = null;
  }

  private pushEntry(entry: ActivityEntry): void {
    this.entries.push(entry);
    this.enforceBounds();
  }

  private enforceBounds(): void {
    while (this.entries.length > ACTIVITY_LIMITS.entries) {
      const removed = this.entries.shift();
      if (!removed) break;
      this.toolsByCallId.forEach((value, key) => {
        if (value === removed) this.toolsByCallId.delete(key);
      });
      if (this.openThought === removed) this.openThought = null;
      this.detailBytes -= removed.detail ? detailByteLength(removed.detail) : 0;
      this.overflowed = true;
    }
    while (this.detailBytes > ACTIVITY_LIMITS.totalDetailBytes) {
      const oldest = this.entries.find((entry) => entry.detail !== undefined);
      if (!oldest?.detail) break;
      this.detailBytes -= detailByteLength(oldest.detail);
      oldest.detail = undefined;
      oldest.truncated = true;
      this.overflowed = true;
    }
  }

  private beginThoughtUnsafe(afterSequence: number, text: string, at?: number): void {
    const sequence = z.number().int().nonnegative().parse(afterSequence);
    const content = z.string().max(2 * 1024 * 1024).parse(text);
    if (this.openThought && this.entries.at(-1) === this.openThought) {
      const clipped = utf8Tail(
        `${this.openThought.detail?.type === 'text' ? this.openThought.detail.text : ''}${cleanDetailText(content)}`,
        ACTIVITY_LIMITS.detailBytes,
      );
      this.detailBytes -= this.openThought.detail ? detailByteLength(this.openThought.detail) : 0;
      this.openThought.detail = { type: 'text', text: clipped.text };
      this.detailBytes += Buffer.byteLength(clipped.text, 'utf8');
      this.openThought.truncated ||= clipped.truncated;
      if (at !== undefined) this.openThought.endedAt = at;
      return;
    }
    const clipped = utf8Tail(cleanDetailText(content), ACTIVITY_LIMITS.detailBytes);
    const entry: ActivityEntry = {
      id: `thought_${(this.thoughtCounter += 1)}`,
      afterSequence: sequence,
      kind: 'thought',
      status: 'running',
      title: 'Thought',
      detail: { type: 'text', text: clipped.text },
      truncated: clipped.truncated,
      ...(at !== undefined ? { startedAt: at } : {}),
    };
    this.detailBytes += Buffer.byteLength(clipped.text, 'utf8');
    this.openThought = entry;
    this.pushEntry(entry);
  }

  private beginToolUnsafe(
    afterSequence: number,
    input: unknown,
    cwd: string,
    at?: number,
  ): void {
    const sequence = z.number().int().nonnegative().parse(afterSequence);
    const parsed = toolCallInputSchema.parse(input);
    const existing = this.toolsByCallId.get(parsed.toolCallId);
    if (existing) {
      this.updateToolUnsafe(parsed.toolCallId, parsed, at);
      return;
    }
    this.closeOpenThought(at);
    const toolKind = parsed.kind && ACTIVITY_TOOL_KINDS.has(parsed.kind)
      ? (parsed.kind as ActivityToolKind)
      : activityKindFromToolName(inferenceToolName(parsed._meta) ?? '');

    const paths = new Set<string>();
    const texts: string[] = [];
    let diff: ActivityDetail | null = null;
    for (const item of parsed.content ?? []) {
      const diffResult = diffContentSchema.safeParse(item);
      if (diffResult.success) {
        const relativePath = relativeActivityPath(diffResult.data.path, cwd);
        if (relativePath) paths.add(relativePath);
        if (!diff && relativePath) {
          diff = {
            type: 'diff',
            path: relativePath,
            ...(diffResult.data.oldText !== undefined
              ? { oldText: diffResult.data.oldText }
              : {}),
            ...(diffResult.data.newText !== undefined
              ? { newText: diffResult.data.newText }
              : {}),
          };
        }
        continue;
      }
      const wrapper = wrapperContentSchema.safeParse(item);
      if (!wrapper.success) {
        this.overflowed = true;
        continue;
      }
      const inner = wrapper.data.content;
      if (inner.type === 'text' && typeof inner.text === 'string') {
        texts.push(inner.text);
      } else if (
        inner.type === 'resource' &&
        inner.resource?.mimeType === 'text/x-shellscript' &&
        typeof inner.resource.text === 'string'
      ) {
        texts.push(`$ ${inner.resource.text}\n`);
      }
    }
    for (const location of parsed.locations ?? []) {
      const relativePath = relativeActivityPath(location.path, cwd);
      if (relativePath) paths.add(relativePath);
    }

    let detail: ActivityDetail | undefined;
    let truncated = false;
    if (diff) {
      const clipped = clipActivityDetail(diff, ACTIVITY_LIMITS.detailBytes);
      detail = clipped.detail;
      truncated = clipped.truncated;
    } else if (texts.length > 0) {
      const clipped = clipActivityDetail(
        { type: 'text', text: texts.join('\n') },
        ACTIVITY_LIMITS.detailBytes,
      );
      detail = clipped.detail;
      truncated = clipped.truncated;
    }

    const status = activityStatusFromAcp(parsed.status);
    const entry: ActivityEntry = {
      id: toolEntryId(parsed.toolCallId),
      afterSequence: sequence,
      kind: 'tool',
      toolKind,
      status: status === 'unknown' ? 'running' : status,
      title: cleanActivityTitle(parsed.title, 'Tool call'),
      ...(paths.size > 0 ? { paths: [...paths].slice(0, ACTIVITY_LIMITS.paths) } : {}),
      ...(detail ? { detail } : {}),
      truncated,
      ...(at !== undefined ? { startedAt: at } : {}),
      ...((status === 'completed' || status === 'failed') &&
      this.effectiveAt(at) !== undefined
        ? { endedAt: this.effectiveAt(at) }
        : {}),
    };
    this.toolsByCallId.set(parsed.toolCallId, entry);
    if (detail) this.detailBytes += detailByteLength(detail);
    this.pushEntry(entry);
  }

  private updateToolUnsafe(toolCallId: string, input: unknown, at?: number): void {
    const callId = z.string().min(1).max(512).parse(toolCallId);
    const entry = this.toolsByCallId.get(callId);
    if (!entry) return;
    if (entry.status === 'timed_out') return;
    const parsed = toolUpdateInputSchema.parse(input);
    const status = activityStatusFromAcp(parsed.status);
    if (status !== 'unknown') entry.status = status;
    const texts: string[] = [];
    for (const item of parsed.content ?? []) {
      const wrapper = wrapperContentSchema.safeParse(item);
      if (!wrapper.success) {
        this.overflowed = true;
        continue;
      }
      const inner = wrapper.data.content;
      if (inner.type === 'text' && typeof inner.text === 'string') texts.push(inner.text);
      else if (
        inner.type === 'resource' &&
        inner.resource?.mimeType === 'text/x-shellscript' &&
        typeof inner.resource.text === 'string'
      ) {
        texts.push(`$ ${inner.resource.text}\n`);
      }
    }
    if (typeof parsed.rawOutput === 'string') texts.push(parsed.rawOutput);
    const terminalExit = parsed._meta?.terminal_exit;
    const exitCode =
      terminalExit && typeof terminalExit === 'object' && !Array.isArray(terminalExit)
        ? (terminalExit as Record<string, unknown>).exit_code
        : undefined;
    if (typeof exitCode === 'number' && Number.isInteger(exitCode)) {
      texts.push(`\nExit code: ${exitCode}`);
    }
    if (texts.length > 0) {
      const addition = cleanDetailText(texts.join('\n'));
      if (!entry.detail) {
        const clipped = utf8Tail(addition, ACTIVITY_LIMITS.detailBytes);
        entry.detail = { type: 'text', text: clipped.text };
        entry.truncated ||= clipped.truncated;
        this.detailBytes += Buffer.byteLength(clipped.text, 'utf8');
      } else if (entry.detail.type === 'text') {
        this.detailBytes -= detailByteLength(entry.detail);
        const clipped = utf8Tail(`${entry.detail.text}${addition}`, ACTIVITY_LIMITS.detailBytes);
        entry.detail = { type: 'text', text: clipped.text };
        entry.truncated ||= clipped.truncated;
        this.detailBytes += Buffer.byteLength(clipped.text, 'utf8');
      }
    }
    if (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'interrupted') {
      const ended = this.effectiveAt(at);
      if (ended !== undefined) entry.endedAt = ended;
    }
    this.enforceBounds();
  }
}
