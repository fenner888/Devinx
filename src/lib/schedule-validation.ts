import type { ScheduleType } from '@api/devin/types';

export function normalizeScheduleTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function validateScheduleTiming(
  scheduleType: ScheduleType,
  frequency: string,
  scheduledAt: string,
  now = Date.now(),
): string | null {
  if (scheduleType === 'recurring') {
    const fields = frequency.trim().split(/\s+/);
    return fields.length >= 5 && fields.length <= 7
      ? null
      : 'Enter a valid cron expression with 5 to 7 fields.';
  }

  const timestamp = Date.parse(scheduledAt.trim());
  if (!Number.isFinite(timestamp)) return 'Enter a valid ISO 8601 date and time.';
  if (timestamp <= now) return 'One-time automations must run in the future.';
  return null;
}
