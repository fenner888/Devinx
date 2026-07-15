import { statusLabels } from '../../src/theme/tokens';
import { DEVIN_FRAME_SETS } from '../../src/pets/devin/assets';
import {
  DEVIN_STATE_ANIMATIONS,
  DEVIN_STATE_BY_STATUS_KEY,
  devinMessageForStatusKey,
  devinStateForStatusKey,
} from '../../src/pets/devin/model';

describe('Devin pet model', () => {
  it('maps every canonical status key', () => {
    expect(Object.keys(DEVIN_STATE_BY_STATUS_KEY).sort()).toEqual(Object.keys(statusLabels).sort());
  });

  it('uses calm waiting frames for routine blocked states', () => {
    expect(DEVIN_STATE_ANIMATIONS.blocked.frames).toBe(DEVIN_FRAME_SETS.waiting);
    expect(devinStateForStatusKey('waitingForResponse')).toBe('waiting');
    expect(devinStateForStatusKey('approvalRequired')).toBe('blocked');
  });

  it('reserves failed frames for warning and error states', () => {
    expect(DEVIN_STATE_ANIMATIONS.warning.frames).toBe(DEVIN_FRAME_SETS.failed);
    expect(DEVIN_STATE_ANIMATIONS.error.frames).toBe(DEVIN_FRAME_SETS.failed);
    expect(devinStateForStatusKey('crashed')).toBe('error');
  });

  it('uses canonical labels only for actionable companion messages', () => {
    expect(devinMessageForStatusKey('approvalRequired')).toBe(statusLabels.approvalRequired);
    expect(devinMessageForStatusKey('working')).toBeUndefined();
    expect(devinMessageForStatusKey('done')).toBeUndefined();
  });

  it('keeps completion animations finite', () => {
    expect(DEVIN_STATE_ANIMATIONS.success.loop).toBe(false);
    expect(DEVIN_STATE_ANIMATIONS.celebrating.loop).toBe(false);
  });
});
