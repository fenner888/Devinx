import type { ComputerActivityStatus } from '@auth/computerBridge';
import { statusLabels, type StatusLabelKey } from '@theme/tokens';

export type ComputerActivityKindName =
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'executing'
  | 'searching'
  | 'fetching'
  | 'responding';

const ACTIVITY_SHORT_LABELS: Record<ComputerActivityKindName, string> = {
  thinking: 'Thinking',
  reading: 'Reading files',
  editing: 'Editing files',
  executing: 'Running a command',
  searching: 'Searching',
  fetching: 'Fetching',
  responding: 'Responding',
};

export function activityShortLabel(kind: ComputerActivityKindName): string {
  return ACTIVITY_SHORT_LABELS[kind] ?? ACTIVITY_SHORT_LABELS.thinking;
}

export function activityStatusLabel(status: ComputerActivityStatus): string {
  const label = statusLabels[status as StatusLabelKey];
  return label ?? statusLabels.unknown;
}
