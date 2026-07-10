export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  consume(key: string, rule: RateLimitRule, now: number): boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function validRule(rule: RateLimitRule): boolean {
  return (
    Number.isSafeInteger(rule.limit) &&
    rule.limit > 0 &&
    Number.isSafeInteger(rule.windowMs) &&
    rule.windowMs > 0
  );
}

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly maximumEntries = 10_000) {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error('Rate limiter capacity must be a positive safe integer');
    }
  }

  consume(key: string, rule: RateLimitRule, now: number): boolean {
    if (!key || key.length > 512 || !validRule(rule) || !Number.isSafeInteger(now)) return false;
    for (const [entryKey, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(entryKey);
    }

    const current = this.entries.get(key);
    if (!current) {
      if (this.entries.size >= this.maximumEntries) return false;
      this.entries.set(key, { count: 1, resetAt: now + rule.windowMs });
      return true;
    }
    if (current.count >= rule.limit) return false;
    current.count += 1;
    return true;
  }
}
