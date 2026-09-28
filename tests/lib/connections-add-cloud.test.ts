import { canAddCloudToLocal } from '../../src/lib/connections';

describe('canAddCloudToLocal', () => {
  it('allows Cloud to be added to Local when at least one device is paired', () => {
    expect(canAddCloudToLocal('computer', 1)).toBe(true);
  });

  it.each([
    ['computer', 0],
    ['cloud', 1],
    ['both', 1],
  ] as const)('returns false for mode %s with %i paired devices', (mode, computerCount) => {
    expect(canAddCloudToLocal(mode, computerCount)).toBe(false);
  });
});
