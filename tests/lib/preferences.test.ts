jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  normalizeConnectionMode,
  connectionModeUsesComputer,
  isConnectionModeConfigured,
  shouldEnableCloudRequests,
} from '../../src/lib/connections';
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

  it('normalizes unknown persisted connection modes to Cloud', () => {
    expect(normalizeConnectionMode('computer')).toBe('computer');
    expect(normalizeConnectionMode('both')).toBe('both');
    expect(normalizeConnectionMode('unexpected')).toBe('cloud');
  });

  it.each([
    ['cloud', true, false, true],
    ['cloud', false, true, false],
    ['computer', false, true, true],
    ['computer', true, false, false],
    ['both', true, true, true],
    ['both', true, false, false],
  ] as const)(
    'evaluates %s connection readiness without weakening either requirement',
    (mode, cloud, computer, expected) => {
      expect(isConnectionModeConfigured(mode, cloud, computer)).toBe(expected);
    },
  );

  it('disables Cloud requests in Computer-only mode even when credentials remain stored', () => {
    expect(shouldEnableCloudRequests('computer', true, true)).toBe(false);
    expect(shouldEnableCloudRequests('cloud', true, true)).toBe(true);
    expect(shouldEnableCloudRequests('both', true, true)).toBe(true);
    expect(shouldEnableCloudRequests('cloud', true, false)).toBe(false);
  });

  it('enables Computer requests only in Computer and combined modes', () => {
    expect(connectionModeUsesComputer('cloud')).toBe(false);
    expect(connectionModeUsesComputer('computer')).toBe(true);
    expect(connectionModeUsesComputer('both')).toBe(true);
  });
});
