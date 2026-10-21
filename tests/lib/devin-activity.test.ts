import { activityForComputerSession } from '../../src/pets/devin/activity';

describe('Local live activity', () => {
  it('maps sanitized computer tool activity to the matching companion pose', () => {
    expect(
      activityForComputerSession(
        { active: true, kind: 'executing', label: 'Running npm test', updatedAt: 3 },
        true,
      ),
    ).toEqual({ state: 'focused', message: 'Devin working', travel: true });
  });

  it('shows connector activity even when the phone did not initiate the prompt', () => {
    expect(
      activityForComputerSession(
        { active: true, kind: 'editing', label: 'Editing app.tsx', updatedAt: 4 },
        false,
      ),
    ).toEqual({ state: 'working', message: 'Devin working', travel: true });
  });

  it('does not show a passive message bubble while an inactive computer session waits', () => {
    expect(activityForComputerSession(undefined, false)).toEqual({
      state: 'waiting',
      travel: false,
    });
  });

});
