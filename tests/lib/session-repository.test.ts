jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(async () => undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionResponse } from '../../src/api/devin/types';
import {
  getSessionMode,
  getSessionRepository,
  rememberSessionMode,
  rememberSessionRepository,
} from '../../src/lib/session-repository';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function session(prUrl?: string): SessionResponse {
  return {
    acus_consumed: 0,
    category: null,
    child_session_ids: null,
    created_at: 1,
    is_archived: false,
    org_id: 'org-1',
    origin: 'api',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: prUrl ? [{ pr_url: prUrl, pr_state: 'open', state: 'open' }] : [],
    service_user_id: null,
    session_id: 'session-1',
    status: 'running',
    tags: [],
    title: 'Session',
    updated_at: 1,
    url: 'https://app.devin.ai/sessions/session-1',
  };
}

describe('session repository context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists and reads the selected repository', async () => {
    storage.getItem.mockResolvedValue('fenner888/Devinx');

    await rememberSessionRepository('session-1', 'fenner888/Devinx');

    expect(storage.setItem).toHaveBeenCalledWith(
      '@devinx/session-repository/session-1',
      'fenner888/Devinx',
    );
    await expect(getSessionRepository(session())).resolves.toBe('fenner888/Devinx');
  });

  it('persists and reads the selected session mode', async () => {
    storage.getItem.mockResolvedValue('fast');

    await rememberSessionMode('session-1', 'fast');

    expect(storage.setItem).toHaveBeenCalledWith('@devinx/session-mode/session-1', 'fast');
    await expect(getSessionMode('session-1')).resolves.toBe('fast');
  });

  it('rejects unknown stored session modes', async () => {
    storage.getItem.mockResolvedValue('unknown');

    await expect(getSessionMode('session-1')).resolves.toBeNull();
  });

  it('ignores a previously cached preview mode that is not in the public API contract', async () => {
    storage.getItem.mockResolvedValue('fusion');

    await expect(getSessionMode('session-1')).resolves.toBeNull();
  });

  it('falls back to the repository in a pull request URL', async () => {
    storage.getItem.mockResolvedValue(null);

    await expect(
      getSessionRepository(session('https://github.com/fenner888/Devinx/pull/26')),
    ).resolves.toBe('fenner888/Devinx');
  });

  it('returns null when the API exposes no repository context', async () => {
    storage.getItem.mockResolvedValue(null);

    await expect(getSessionRepository(session())).resolves.toBeNull();
  });
});
