import { formatRefreshInterval, localRefreshIntervals } from '../../src/lib/polling';

describe('local refresh intervals', () => {
  it.each([
    ['battery_saver', { sessionList: 60_000, history: 6_000, activity: 3_000 }],
    ['balanced', { sessionList: 30_000, history: 3_000, activity: 1_500 }],
    ['fast', { sessionList: 15_000, history: 1_500, activity: 1_000 }],
  ] as const)('returns %s intervals', (mode, expected) => {
    expect(localRefreshIntervals(mode)).toEqual(expected);
  });

  it('formats fractional and whole seconds', () => {
    expect(formatRefreshInterval(1_500)).toBe('1.5s');
    expect(formatRefreshInterval(30_000)).toBe('30s');
  });
});
