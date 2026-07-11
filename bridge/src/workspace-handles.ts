import { createHmac } from 'node:crypto';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { canonicalJson } from './canonical';
import { opaqueIdSchema } from './schemas';

const workspacePathSchema = z.string().min(1).max(4_096).refine(isAbsolute);
const workspaceHandleSchema = z.string().regex(/^workspace_[A-Za-z0-9_-]{43}$/);

interface WorkspaceHandleEntry {
  path: string;
  expiresAt: number;
}

export class WorkspaceHandleRegistry {
  private readonly entries = new Map<string, WorkspaceHandleEntry>();
  private readonly bridgeId: string;
  private readonly key: Buffer;
  private destroyed = false;

  constructor(
    bridgeId: string,
    key: Uint8Array,
    private readonly lifetimeMs = 24 * 60 * 60 * 1_000,
    private readonly maximumEntries = 1_000,
  ) {
    this.bridgeId = opaqueIdSchema.parse(bridgeId);
    this.key = Buffer.from(key);
    if (this.key.length !== 32) throw new Error('Workspace handle key must contain 32 bytes');
    if (!Number.isSafeInteger(this.lifetimeMs) || this.lifetimeMs < 1) {
      throw new Error('Workspace handle lifetime must be a positive safe integer');
    }
    if (!Number.isSafeInteger(this.maximumEntries) || this.maximumEntries < 1) {
      throw new Error('Workspace handle capacity must be a positive safe integer');
    }
  }

  register(input: unknown, now = Date.now()): string {
    if (this.destroyed) throw new Error('Workspace handle registry is destroyed');
    const path = workspacePathSchema.parse(input);
    if (!Number.isSafeInteger(now)) throw new Error('Workspace handle time must be a safe integer');
    this.cleanup(now);
    const digest = createHmac('sha256', this.key)
      .update(canonicalJson({ bridgeId: this.bridgeId, kind: 'workspace', path }), 'utf8')
      .digest('base64url');
    const handle = workspaceHandleSchema.parse(`workspace_${digest}`);
    const existing = this.entries.get(handle);
    if (existing && existing.path !== path) throw new Error('Workspace handle collision detected');
    if (!existing && this.entries.size >= this.maximumEntries) {
      throw new Error('Workspace handle capacity reached');
    }
    this.entries.set(handle, { path, expiresAt: now + this.lifetimeMs });
    return handle;
  }

  resolve(input: unknown, now = Date.now()): string | null {
    if (this.destroyed || !Number.isSafeInteger(now)) return null;
    const handle = workspaceHandleSchema.safeParse(input);
    if (!handle.success) return null;
    this.cleanup(now);
    return this.entries.get(handle.data)?.path ?? null;
  }

  destroy(): void {
    this.entries.clear();
    this.key.fill(0);
    this.destroyed = true;
  }

  private cleanup(now: number): void {
    for (const [handle, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(handle);
    }
  }
}
