import type { PollingMode } from '@store/preferences';

const INTERVALS: Record<PollingMode, { sessionList: number; history: number; activity: number }> = {
  battery_saver: { sessionList: 60_000, history: 6_000, activity: 3_000 },
  balanced: { sessionList: 30_000, history: 3_000, activity: 1_500 },
  fast: { sessionList: 15_000, history: 1_500, activity: 1_000 },
};

export function localRefreshIntervals(mode: PollingMode) {
  return INTERVALS[mode];
}

export function formatRefreshInterval(intervalMs: number): string {
  const seconds = intervalMs / 1_000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}
