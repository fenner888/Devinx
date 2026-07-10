import { createHmac } from 'node:crypto';

import { z } from 'zod';

import { canonicalJson } from './canonical';
import { opaqueIdSchema, sessionIdSchema } from './schemas';

const sessionHandleSchema = z.string().regex(/^local_[A-Za-z0-9_-]{43}$/);

interface SessionHandleEntry {
  sessionId: string;
  expiresAt: number;
}

export class SessionHandleRegistry {
  private readonly entries = new Map<string, SessionHandleEntry>();
  private readonly bridgeId: string;
  private readonly key: Buffer;
  private destroyed = false;

  constructor(
    bridgeId: string,
    key: Uint8Array,
    private readonly lifetimeMs = 24 * 60 * 60 * 1_000,
    private readonly maximumEntries = 10_000,
  ) {
    this.bridgeId = opaqueIdSchema.parse(bridgeId);
    this.key = Buffer.from(key);
    if (this.key.length !== 32) throw new Error('Session handle key must contain 32 bytes');
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 60_000) {
      throw new Error('Session handle lifetime must be at least one minute');
    }
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error('Session handle capacity must be a positive safe integer');
    }
  }

  register(input: unknown, now = Date.now()): string {
    if (this.destroyed) throw new Error('Session handle registry is destroyed');
    const sessionId = sessionIdSchema.parse(input);
    if (!Number.isSafeInteger(now)) throw new Error('Session handle time must be a safe integer');
    this.cleanup(now);
    const digest = createHmac('sha256', this.key)
      .update(canonicalJson({ bridgeId: this.bridgeId, sessionId }), 'utf8')
      .digest('base64url');
    const handle = sessionHandleSchema.parse(`local_${digest}`);
    const existing = this.entries.get(handle);
    if (existing && existing.sessionId !== sessionId) {
      throw new Error('Session handle collision detected');
    }
    if (!existing && this.entries.size >= this.maximumEntries) {
      throw new Error('Session handle capacity reached');
    }
    this.entries.set(handle, { sessionId, expiresAt: now + this.lifetimeMs });
    return handle;
  }

  resolve(input: unknown, now = Date.now()): string | null {
    if (this.destroyed) return null;
    const handleResult = sessionHandleSchema.safeParse(input);
    if (!handleResult.success || !Number.isSafeInteger(now)) return null;
    this.cleanup(now);
    return this.entries.get(handleResult.data)?.sessionId ?? null;
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
