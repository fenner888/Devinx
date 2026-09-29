import { formatPollingInterval, pollingModeIntervals } from '../../src/lib/polling';

describe('polling mode intervals', () => {
  it.each([
    ['battery_saver', { sessionList: 30_000, idleSessionList: 120_000, messages: 5_000 }],
    ['balanced', { sessionList: 15_000, idleSessionList: 60_000, messages: 2_500 }],
    ['fast', { sessionList: 7_500, idleSessionList: 30_000, messages: 1_250 }],
  ] as const)('derives the displayed intervals for %s', (mode, expected) => {
    expect(pollingModeIntervals(mode)).toEqual(expected);
  });

  it.each([
    [1_250, '1.3 s'],
    [2_500, '2.5 s'],
    [5_000, '5 s'],
    [7_500, '7.5 s'],
    [30_000, '30 s'],
    [60_000, '1 min'],
    [120_000, '2 min'],
  ])('formats %i milliseconds as %s', (milliseconds, expected) => {
    expect(formatPollingInterval(milliseconds)).toBe(expected);
  });
});
