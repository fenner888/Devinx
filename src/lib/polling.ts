/**
 * Polling policy — spec §8.4 (ADR-003).
 * Returns an interval in ms, or `false` to stop polling.
 *
 * Session 1 implements the live policy; Phase 0 ships the type + defaults.
 */

export type ScreenContext = 'board' | 'session_detail' | 'background' | 'other';

export function pollingPolicy(
  sessionStatus: 'running' | 'suspended' | 'exit' | 'error' | 'new' | 'claimed' | 'resuming' | undefined,
  appState: 'active' | 'inactive' | 'background',
  screen: ScreenContext,
): number | false {
  // Terminal statuses never poll.
  if (sessionStatus === 'exit' || sessionStatus === 'error') return false;

  // Background: OS-scheduled (~15min). Don't poll from JS.
  if (appState === 'background') return false;

  // Foreground defaults.
  if (screen === 'session_detail' && sessionStatus === 'running') return 5_000;
  if (screen === 'board') return 15_000;
  return false;
}

/** 429 backoff with jitter (spec §8.4). */
export function backoffDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs) return retryAfterMs + Math.floor(Math.random() * 500);
  const base = Math.min(1000 * 2 ** attempt, 60_000);
  return base + Math.floor(Math.random() * 1000);
}
