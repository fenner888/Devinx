jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

import {
  connectionModeAfterComputerRefresh,
  normalizeConnectionMode,
  connectionModeUsesComputer,
  isConnectionModeConfigured,
  shouldEnableCloudRequests,
} from '../../src/lib/connections';
import {
  normalizeDefaultTags,
  normalizeActiveLaunchProfileId,
  normalizeLaunchProfiles,
  useAppPreferences,
} from '../../src/store/preferences';

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

  it('normalizes launch profiles without persisting prompts or secret values', () => {
    const [profile] = normalizeLaunchProfiles([
      {
        id: ' profile-1 ',
        name: ' Mobile defaults ',
        target: 'cloud',
        repositoryPaths: [' owner/repo ', 'owner/repo'],
        mode: 'fast',
        playbookId: ' playbook-1 ',
        knowledgeIds: ['knowledge-1'],
        secretIds: ['secret-reference-1'],
        tags: [' Release ', 'release'],
        maxAcuLimit: 50,
        createdAt: 1,
        updatedAt: 2,
        prompt: 'must not persist',
        secretValue: 'must not persist',
        unlisted: true,
      },
    ]);

    expect(profile).toEqual({
      id: 'profile-1',
      name: 'Mobile defaults',
      target: 'cloud',
      repositoryPaths: ['owner/repo'],
      mode: 'fast',
      playbookId: 'playbook-1',
      knowledgeIds: ['knowledge-1'],
      secretIds: ['secret-reference-1'],
      tags: ['release'],
      maxAcuLimit: 50,
      createdAt: 1,
      updatedAt: 2,
    });
    expect(JSON.stringify(profile)).not.toContain('must not persist');
    expect(profile).not.toHaveProperty('unlisted');
  });

  it('fails closed for malformed launch profiles and bounded numeric fields', () => {
    expect(
      normalizeLaunchProfiles([
        { id: '', name: 'Missing ID', target: 'cloud' },
        { id: 'local', name: 'Wrong target', target: 'localDevice' },
        {
          id: 'valid',
          name: 'Valid',
          target: 'cloud',
          mode: 'unsupported',
          maxAcuLimit: 1.5,
          createdAt: -1,
          updatedAt: -2,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'valid',
        mode: 'normal',
        maxAcuLimit: undefined,
      }),
    ]);
  });

  it('drops an active launch profile reference when its profile was rejected or removed', () => {
    const profiles = normalizeLaunchProfiles([
      {
        id: 'profile-1',
        name: 'Defaults',
        target: 'cloud',
        mode: 'normal',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(normalizeActiveLaunchProfileId(' profile-1 ', profiles)).toBe('profile-1');
    expect(normalizeActiveLaunchProfileId('missing-profile', profiles)).toBeNull();
    expect(normalizeActiveLaunchProfileId(42, profiles)).toBeNull();
  });

  it('rejects a stale active launch profile ID at write time', () => {
    const [profile] = normalizeLaunchProfiles([
      {
        id: 'profile-1',
        name: 'Defaults',
        target: 'cloud',
        mode: 'normal',
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    if (!profile) throw new Error('Expected normalized launch profile');
    useAppPreferences.setState({ launchProfiles: [profile], activeLaunchProfileId: null });

    useAppPreferences.getState().setActiveLaunchProfile('missing-profile');
    expect(useAppPreferences.getState().activeLaunchProfileId).toBeNull();
    useAppPreferences.getState().setActiveLaunchProfile('profile-1');
    expect(useAppPreferences.getState().activeLaunchProfileId).toBe('profile-1');
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

  it('keeps cloud users configured after their final combined-mode computer is removed', () => {
    expect(connectionModeAfterComputerRefresh('both', true, 0)).toBe('cloud');
    expect(connectionModeAfterComputerRefresh('both', true, 1)).toBe('both');
    expect(connectionModeAfterComputerRefresh('computer', true, 0)).toBe('computer');
    expect(connectionModeAfterComputerRefresh('both', false, 0)).toBe('both');
  });

  it('resets all persisted user-scoped preferences on disconnect', () => {
    useAppPreferences.setState({
      defaultTags: ['private'],
      pinnedSessionIds: ['session-1'],
      watchedSessionIds: ['session-2'],
      composerTemplates: [{ id: 'template-1', name: 'Draft', prompt: 'private prompt' }],
      launchProfiles: [
        {
          id: 'profile-1',
          name: 'Defaults',
          target: 'cloud',
          repositoryPaths: ['owner/repo'],
          mode: 'normal',
          knowledgeIds: [],
          secretIds: ['secret-reference-1'],
          tags: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeLaunchProfileId: 'profile-1',
      acknowledgedActionIds: ['cloud:session-1:input:1'],
      connectionMode: 'both',
    });

    useAppPreferences.getState().resetUserScopedData();

    expect(useAppPreferences.getState()).toMatchObject({
      defaultTags: [],
      pinnedSessionIds: [],
      watchedSessionIds: [],
      composerTemplates: [],
      launchProfiles: [],
      activeLaunchProfileId: null,
      acknowledgedActionIds: [],
      connectionMode: 'cloud',
    });
  });
});
