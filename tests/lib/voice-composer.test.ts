jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
}));

import { insertSpokenText } from '../../src/components/VoiceInput/useVoiceComposer';

describe('voice composer insertion', () => {
  it('inserts finalized speech at the cursor without replacing typed text', () => {
    expect(insertSpokenText('Fix auth now', 4, 4, 'the Zod', 100)).toEqual({
      value: 'Fix the Zod auth now',
      cursor: 12,
      inserted: 'the Zod ',
    });
  });

  it('replaces only the selected range', () => {
    expect(insertSpokenText('Fix old middleware', 4, 7, 'the auth', 100).value).toBe(
      'Fix the auth middleware',
    );
  });

  it('never truncates existing typed text when the maximum length is reached', () => {
    expect(insertSpokenText('Keep tail', 5, 5, 'a very long insertion', 12)).toEqual({
      value: 'Keep a tail',
      cursor: 7,
      inserted: 'a ',
    });
  });
});
