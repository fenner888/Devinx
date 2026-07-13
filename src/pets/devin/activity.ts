import type { SessionResponse } from '@api/devin/types';
import type { ComputerSessionActivity } from '@auth/computerBridge';
import type { StatusLabelKey } from '@theme/tokens';
import { devinStateForStatusKey } from './model';
import type { DevinPetState } from './types';

export interface DevinSessionActivity {
  state: DevinPetState;
  message?: string;
  travel: boolean;
}

const STATUS_ACTIVITY: Partial<Record<StatusLabelKey, string>> = {
  waitingForResponse: 'Waiting for your reply',
  exceededLimit: 'Paused at the session limit',
  crashed: 'The session needs attention',
  closed: 'Session closed',
  done: 'Task complete',
  approveSession: 'Waiting for session approval',
  approveDeployment: 'Waiting for deployment approval',
  approvalRequired: 'Waiting for your approval',
  approveKnowledge: 'Waiting for knowledge approval',
  reviewPR: 'Reviewing the pull request',
  prReady: 'Pull request ready',
  prReadyWaitingCI: 'Watching CI checks',
  waitingForCI: 'Waiting for CI checks',
};

function cleanActivityText(value: string | null | undefined): string | undefined {
  const printable = value
    ? Array.from(value, (character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint < 32 || codePoint === 127 ? ' ' : character;
      }).join('')
    : undefined;
  const cleaned = printable?.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length > 96 ? `${cleaned.slice(0, 93).trimEnd()}…` : cleaned;
}

function stateForWorkingReason(reason: string): DevinPetState {
  const normalized = reason.toLowerCase();
  if (/\b(test|testing|verify|verifying|check|checking|lint|build|review)\b/.test(normalized)) {
    return 'focused';
  }
  if (/\b(edit|editing|write|writing|implement|coding|refactor|fixing|file)\b/.test(normalized)) {
    return 'working';
  }
  if (/\b(plan|planning|think|thinking|analy|research|inspect|read|search)\b/.test(normalized)) {
    return 'thinking';
  }
  return 'working';
}

export function activityForCloudSession(
  session: SessionResponse,
  statusKey: StatusLabelKey,
  isSending: boolean,
): DevinSessionActivity {
  if (isSending) {
    return { state: 'thinking', message: 'Reading your message', travel: true };
  }

  const state = devinStateForStatusKey(statusKey);
  if (statusKey !== 'working') {
    const toolName = cleanActivityText(session.latest_permission_contents?.tool_name);
    const fallback = STATUS_ACTIVITY[statusKey];
    return {
      state,
      message:
        toolName && statusKey === 'approvalRequired' ? `Approval needed: ${toolName}` : fallback,
      travel: false,
    };
  }

  const reason = cleanActivityText(session.latest_status_contents?.reason);
  const workingState = reason ? stateForWorkingReason(reason) : 'working';
  return {
    state: workingState,
    message: reason ?? 'Working on your task',
    // Every canonical active-work state walks. The semantic pose still drives
    // the message/accessibility state, while the travel track supplies the
    // directional walking frames until Devin reaches a passive/terminal state.
    travel: true,
  };
}

export function activityForComputerSession(
  activity: ComputerSessionActivity | undefined,
  steeringActive: boolean,
): DevinSessionActivity {
  if (activity?.active) {
    const message = cleanActivityText(activity.label) ?? 'Working through Devin on your Mac';
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
    return { state: 'thinking', message: 'Working through Devin on your Mac', travel: true };
  }
  return { state: 'waiting', travel: false };
}
