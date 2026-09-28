import { formatClockTime, formatDayLabel, formatFullDate, messageTimeLabels } from '../../src/lib/messageTime';

describe('message time formatting', () => {
  it('formats midnight, noon, and local clock times', () => {
    expect(formatClockTime(new Date(2026, 8, 28, 0, 5).getTime())).toBe('12:05 AM');
    expect(formatClockTime(new Date(2026, 8, 28, 12, 0).getTime())).toBe('12:00 PM');
    expect(formatClockTime(new Date(2026, 8, 28, 15, 41).getTime())).toBe('3:41 PM');
  });

  it('formats today, yesterday, same-year, and other-year calendar days', () => {
    const now = new Date(2026, 8, 28, 12).getTime();
    expect(formatDayLabel(new Date(2026, 8, 28, 0).getTime(), now)).toBe('Today');
    expect(formatDayLabel(new Date(2026, 8, 27, 23).getTime(), now)).toBe('Yesterday');
    expect(formatDayLabel(new Date(2026, 8, 26, 12).getTime(), now)).toBe('Sep 26');
    expect(formatDayLabel(new Date(2025, 8, 26, 12).getTime(), now)).toBe('Sep 26, 2025');
  });

  it('formats a full local date with weekday and month names', () => {
    expect(formatFullDate(new Date(2026, 8, 28, 15, 41).getTime())).toBe(
      'Monday, September 28, 2026 at 3:41 PM',
    );
  });

  it('labels the end of each same-source run and separates changed days', () => {
    const first = new Date(2026, 8, 28, 15, 40).getTime();
    const labels = messageTimeLabels(
      [
        { source: 'user', createdAt: first },
        { source: 'user', createdAt: first + 60_000 },
        { source: 'devin', createdAt: new Date(2026, 8, 29, 9, 0).getTime() },
      ],
      first,
    );

    expect(labels).toEqual([
      { daySeparator: 'Today' },
      { time: '3:41 PM' },
      { daySeparator: 'Sep 29', time: '9:00 AM' },
    ]);
  });

  it('ignores untimed messages when finding day separators and gives them no labels', () => {
    const first = new Date(2026, 8, 28, 15, 40).getTime();
    const nextDay = new Date(2026, 8, 29, 9, 0).getTime();

    expect(
      messageTimeLabels(
        [
          { source: 'user', createdAt: first },
          { source: 'devin' },
          { source: 'devin', createdAt: nextDay },
          { source: 'user' },
        ],
        first,
      ),
    ).toEqual([
      { daySeparator: 'Today', time: '3:40 PM' },
      {},
      { daySeparator: 'Sep 29', time: '9:00 AM' },
      {},
    ]);
  });
});
