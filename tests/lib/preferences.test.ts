jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import { normalizeDefaultTags } from '../../src/store/preferences';

describe('preferences', () => {
  it('normalizes and deduplicates default tags', () => {
    expect(normalizeDefaultTags(' Mobile, priority, mobile,  Release ')).toEqual([
      'mobile',
      'priority',
      'release',
    ]);
  });

  it('drops empty tags and caps the list at 50', () => {
    const input = Array.from({ length: 60 }, (_, index) => `tag-${index}`).join(',');
    expect(normalizeDefaultTags(`, , ${input}`).length).toBe(50);
  });
});
