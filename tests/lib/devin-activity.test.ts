import type { SessionResponse } from '../../src/api/devin/types';
import {
  activityForCloudSession,
  activityForComputerSession,
} from '../../src/pets/devin/activity';

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
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
    pull_requests: [],
    service_user_id: null,
    session_id: 'session-1',
    status: 'running',
    status_detail: 'working',
    tags: [],
    title: 'Test session',
    updated_at: 2,
    url: 'https://app.devin.ai/sessions/session-1',
    ...overrides,
  };
}

describe('Devin live activity', () => {
  it('uses real cloud status reasons to choose an editing pose', () => {
    expect(
      activityForCloudSession(
        session({ latest_status_contents: { enum: 'working', reason: 'Editing src/session.ts' } }),
        'working',
        false,
      ),
    ).toEqual({ state: 'working', message: 'Editing src/session.ts', travel: false });
  });

  it('shows optimistic message reading before cloud status polling catches up', () => {
    expect(activityForCloudSession(session(), 'working', true)).toEqual({
      state: 'thinking',
      message: 'Reading your message',
      travel: true,
    });
  });

  it('maps sanitized computer tool activity to the matching companion pose', () => {
    expect(
      activityForComputerSession(
        { active: true, kind: 'executing', label: 'Running npm test', updatedAt: 3 },
        true,
      ),
    ).toEqual({ state: 'focused', message: 'Running npm test', travel: false });
  });

  it('shows connector activity even when the phone did not initiate the prompt', () => {
    expect(
      activityForComputerSession(
        { active: true, kind: 'editing', label: 'Editing app.tsx', updatedAt: 4 },
        false,
      ),
    ).toEqual({ state: 'working', message: 'Editing app.tsx', travel: false });
  });

  it('does not show a passive message bubble while an inactive computer session waits', () => {
    expect(activityForComputerSession(undefined, false)).toEqual({
      state: 'waiting',
      travel: false,
    });
  });

  it('does not show a generic bubble for passive cloud states', () => {
    expect(
      activityForCloudSession(
        session({ status: 'suspended', status_detail: 'inactivity' }),
        'sleeping',
        false,
      ),
    ).toEqual({ state: 'sleeping', message: undefined, travel: false });
  });
});
