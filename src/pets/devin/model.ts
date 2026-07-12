import { statusLabels, type StatusLabelKey } from '@theme/tokens';
import { DEVIN_FRAME_SETS } from './assets';
import type { DevinAnimationDefinition, DevinPetState } from './types';

export const DEVIN_STATE_ANIMATIONS: Record<DevinPetState, DevinAnimationDefinition> = {
  // The waiting row is the canonical seated Devin. The older idle row changes
  // the leg silhouette between frames and looks inconsistent at home-screen size.
  idle: { frames: DEVIN_FRAME_SETS.waiting, fps: 3, loop: true },
  thinking: { frames: DEVIN_FRAME_SETS.running, fps: 5, loop: true },
  working: { frames: DEVIN_FRAME_SETS.review, fps: 6, loop: true },
  success: { frames: DEVIN_FRAME_SETS.jumping, fps: 8, loop: false },
  // Routine approval and input waits should look patient rather than distressed.
  blocked: { frames: DEVIN_FRAME_SETS.waiting, fps: 4, loop: true },
  warning: { frames: DEVIN_FRAME_SETS.failed, fps: 5, loop: true },
  error: { frames: DEVIN_FRAME_SETS.failed, fps: 6, loop: false },
  reminding: { frames: DEVIN_FRAME_SETS.waving, fps: 5, loop: true },
  sleeping: { frames: DEVIN_FRAME_SETS.waiting, fps: 3, loop: true },
  waiting: { frames: DEVIN_FRAME_SETS.waiting, fps: 4, loop: true },
  celebrating: { frames: DEVIN_FRAME_SETS.jumping, fps: 8, loop: false },
  focused: { frames: DEVIN_FRAME_SETS.review, fps: 4, loop: true },
};

export const DEVIN_STATE_BY_STATUS_KEY: Record<StatusLabelKey, DevinPetState> = {
  working: 'working',
  prReady: 'success',
  prReadyWaitingCI: 'focused',
  waitingForCI: 'focused',
  waitingForResponse: 'waiting',
  exceededLimit: 'blocked',
  crashed: 'error',
  closed: 'waiting',
  done: 'success',
  sleeping: 'sleeping',
  settingUp: 'working',
  planning: 'working',
  coding: 'working',
  iterating: 'working',
  testing: 'working',
  approveSession: 'blocked',
  approveDeployment: 'blocked',
  approvalRequired: 'blocked',
  approveKnowledge: 'blocked',
  reviewPR: 'focused',
};

const ACTIONABLE_COMPANION_STATUSES: ReadonlySet<StatusLabelKey> = new Set([
  'waitingForResponse',
  'exceededLimit',
  'crashed',
  'approveSession',
  'approveDeployment',
  'approvalRequired',
  'approveKnowledge',
]);

export function devinStateForStatusKey(key: StatusLabelKey): DevinPetState {
  return DEVIN_STATE_BY_STATUS_KEY[key];
}

export function devinMessageForStatusKey(key: StatusLabelKey): string | undefined {
  return ACTIONABLE_COMPANION_STATUSES.has(key) ? statusLabels[key] : undefined;
}
