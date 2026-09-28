const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function localDayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function localDateLabel(ms: number, now: number): string {
  const date = new Date(ms);
  const current = new Date(now);
  if (localDayKey(ms) === localDayKey(now)) return 'Today';

  const yesterday = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDayKey(ms) === localDayKey(yesterday.getTime())) return 'Yesterday';

  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  return date.getFullYear() === current.getFullYear()
    ? `${month} ${date.getDate()}`
    : `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatClockTime(ms: number): string {
  const date = new Date(ms);
  const hour = date.getHours();
  const displayHour = hour % 12 || 12;
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${displayHour}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDayLabel(ms: number, now: number): string {
  return localDateLabel(ms, now);
}

export function formatFullDate(ms: number): string {
  const date = new Date(ms);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${formatClockTime(ms)}`;
}

export function messageTimeLabels(
  messages: Array<{ source: string; createdAt?: number }>,
  now: number,
): Array<{ daySeparator?: string; time?: string }> {
  const labels = messages.map(() => ({} as { daySeparator?: string; time?: string }));
  let previousTimestampedDay: string | undefined;

  messages.forEach((message, index) => {
    if (message.createdAt === undefined) return;

    const day = localDayKey(message.createdAt);
    if (day !== previousTimestampedDay) {
      labels[index]!.daySeparator = formatDayLabel(message.createdAt, now);
    }
    previousTimestampedDay = day;

    if (messages[index + 1]?.source !== message.source) {
      labels[index]!.time = formatClockTime(message.createdAt);
    }
  });

  return labels;
}
