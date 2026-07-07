/**
 * Polling policy — spec §8.4 (ADR-003).
 * Returns an interval in ms, or `false` to stop polling.
 */

export type ScreenContext = 'board' | 'session_detail' | 'background' | 'other';

export type PollingMode = 'battery_saver' | 'balanced' | 'fast';

const MODE_FACTOR: Record<PollingMode, number> = {
  battery_saver: 2,
  balanced: 1,
  fast: 0.5,
};

/** Scale a polling interval by the user's polling-mode preference. */
export function scalePolling(interval: number | false, mode: PollingMode = 'balanced'): number | false {
  if (interval === false) return false;
  return Math.round(interval * MODE_FACTOR[mode]);
}

export function pollingPolicy(
  sessionStatus: 'running' | 'suspended' | 'exit' | 'error' | 'new' | 'claimed' | 'resuming' | undefined,
  appState: 'active' | 'inactive' | 'background',
  screen: ScreenContext,
  mode: PollingMode = 'balanced',
): number | false {
  // Terminal statuses never poll.
  if (sessionStatus === 'exit' || sessionStatus === 'error') return false;

  // Background: OS-scheduled (~15min). Don't poll from JS.
  if (appState === 'background') return false;

  // Foreground defaults.
  if (screen === 'session_detail') {
    // Sleeping sessions only change when woken — poll gently to notice.
    if (sessionStatus === 'suspended') return scalePolling(30_000, mode);
    // running / new / claimed / resuming (and unknown) — the session is live.
    return scalePolling(5_000, mode);
  }
  if (screen === 'board') return scalePolling(15_000, mode);
  return false;
}

/** 429 backoff with jitter (spec §8.4). Retry-After is capped at 60s. */
export function backoffDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs) return Math.min(retryAfterMs, 60_000) + Math.floor(Math.random() * 500);
  const base = Math.min(1000 * 2 ** attempt, 60_000);
  return base + Math.floor(Math.random() * 1000);
}
