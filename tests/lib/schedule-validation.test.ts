import {
  normalizeScheduleTags,
  validateScheduleTiming,
} from '../../src/lib/schedule-validation';

describe('schedule validation', () => {
  it('deduplicates and trims tags', () => {
    expect(normalizeScheduleTags(' security, weekly,security, ')).toEqual([
      'security',
      'weekly',
    ]);
  });

  it('requires a cron-shaped recurring frequency', () => {
    expect(validateScheduleTiming('recurring', '0 9 * * 1-5', '')).toBeNull();
    expect(validateScheduleTiming('recurring', 'daily', '')).toMatch(/cron/);
  });

  it('requires a future ISO timestamp for one-time schedules', () => {
    const now = Date.parse('2026-07-12T12:00:00Z');
    expect(
      validateScheduleTiming('one_time', '', '2026-07-13T12:00:00Z', now),
    ).toBeNull();
    expect(validateScheduleTiming('one_time', '', 'not-a-date', now)).toMatch(/ISO 8601/);
    expect(
      validateScheduleTiming('one_time', '', '2026-07-11T12:00:00Z', now),
    ).toMatch(/future/);
  });
});
