jest.mock('../../modules/devinx-voice/src', () => ({
  __esModule: true,
  default: null,
}));

import { cleanDictation, onDeviceScribeEngine, templateWorkOrder } from '../../src/lib/voice/scribe';

describe('private voice scribe', () => {
  it('removes leading filler without changing technical terms', () => {
    expect(cleanDictation('Um, refactor the Zod auth middleware for Expo Router.')).toBe(
      'refactor the Zod auth middleware for Expo Router.',
    );
  });

  it('creates an editable work order with only supplied scope context', () => {
    const result = templateWorkOrder('Fix the session history pagination.', {
      destination: 'My Mac',
      repository: 'DevinX',
    });
    expect(result).toContain('Goal\nFix the session history pagination.');
    expect(result).toContain('Scope / repo\nMy Mac · DevinX');
    expect(result).toContain('Acceptance criteria');
    expect(result).toContain('Constraints / non-goals');
    expect(result).not.toContain('OtherRepo');
  });

  it('falls back to the deterministic template when Apple Intelligence is unavailable', async () => {
    const result = await onDeviceScribeEngine.structure('Add a retry button.', {});
    expect(result.kind).toBe('template');
    expect(result.text).toContain('Goal\nAdd a retry button.');
  });
});
