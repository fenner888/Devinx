export interface ReplayGuard {
  consume(deviceId: string, nonce: string, expiresAt: number, now: number): boolean;
}

export class InMemoryReplayGuard implements ReplayGuard {
  private readonly entries = new Map<string, number>();

  constructor(
    private readonly maximumEntries = 10_000,
    private readonly maximumEntriesPerDevice = 512,
  ) {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error('Replay guard capacity must be a positive safe integer');
    }
    if (
      !Number.isSafeInteger(maximumEntriesPerDevice) ||
      maximumEntriesPerDevice < 1 ||
      maximumEntriesPerDevice > maximumEntries
    ) {
      throw new Error('Per-device replay capacity must fit within total capacity');
    }
  }

  consume(deviceId: string, nonce: string, expiresAt: number, now: number): boolean {
    for (const [key, expiry] of this.entries) {
      if (expiry <= now) this.entries.delete(key);
    }

    const key = `${deviceId}:${nonce}`;
    if (this.entries.has(key) || this.entries.size >= this.maximumEntries) return false;
    let deviceEntries = 0;
    const devicePrefix = `${deviceId}:`;
    for (const existingKey of this.entries.keys()) {
      if (existingKey.startsWith(devicePrefix)) deviceEntries += 1;
    }
    if (deviceEntries >= this.maximumEntriesPerDevice) return false;
    this.entries.set(key, expiresAt);
    return true;
  }
}
