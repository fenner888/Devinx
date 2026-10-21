import type { ComputerSessionActivity } from '@auth/computerBridge';
import type { DevinPetState } from './types';

export interface DevinSessionActivity {
  state: DevinPetState;
  message?: string;
  travel: boolean;
}

export function activityForComputerSession(
  activity: ComputerSessionActivity | undefined,
  steeringActive: boolean,
): DevinSessionActivity {
  if (activity?.active) {
    const message = 'Devin working';
    if (activity.kind === 'editing') {
      return { state: 'working', message, travel: true };
    }
    if (
      activity.kind === 'executing' ||
      activity.kind === 'reading' ||
      activity.kind === 'responding'
    ) {
      return { state: 'focused', message, travel: true };
    }
    return { state: 'thinking', message, travel: true };
  }
  if (steeringActive) {
    return { state: 'thinking', message: 'Devin working', travel: true };
  }
  return { state: 'waiting', travel: false };
}
