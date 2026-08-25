import { deriveActionCenterItems } from '../../src/lib/action-center';
import type { SessionResponse } from '../../src/api/devin/types';

function cloudSession(overrides: Partial<SessionResponse>): SessionResponse {
  return {
    acus_consumed: 0,
    category: null,
    child_session_ids: null,
    created_at: 50,
    is_archived: false,
    org_id: 'org-test',
    origin: 'api',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: [],
    service_user_id: null,
    session_id: 'session-1',
    title: 'Review authentication',
    status: 'running',
    status_detail: 'waiting_for_user',
    tags: [],
    updated_at: 100,
    url: 'https://app.devin.ai/sessions/session-1',
    ...overrides,
  };
}

describe('Action Center', () => {
  it('orders actionable Cloud states by urgency and watched completion last', () => {
    const items = deriveActionCenterItems({
      cloudSessions: [
        cloudSession({
          session_id: 'done',
          status: 'exit',
          status_detail: 'finished',
          updated_at: 400,
        }),
        cloudSession({ session_id: 'error', status: 'error', updated_at: 300 }),
        cloudSession({
          session_id: 'approval',
          status_detail: 'waiting_for_approval',
          updated_at: 200,
        }),
        cloudSession({ session_id: 'input', status_detail: 'waiting_for_user', updated_at: 100 }),
      ],
      watchedSessionIds: ['done'],
    });

    expect(items.map((item) => item.id)).toEqual([
      'cloud:input:input:100',
      'cloud:approval:approval:200',
      'cloud:error:problem:300',
      'cloud:done:completed:400',
    ]);
  });

  it('surfaces signed local-device discovery failures without inventing session status', () => {
    const items = deriveActionCenterItems({
      computerStatuses: [
        {
          bridgeId: 'bridge-1',
          computerName: 'Studio PC',
          state: 'authorization_failed',
        },
      ],
    });

    expect(items).toEqual([
      expect.objectContaining({
        id: 'computer:bridge-1:authorization_failed',
        kind: 'localDevice',
        title: 'Studio PC',
        route: '/(main)/computer-profile/bridge-1',
      }),
    ]);
  });

  it('does not let an old acknowledgement hide a current local-device outage', () => {
    const status = {
      bridgeId: 'bridge-1',
      computerName: 'Studio PC',
      state: 'unavailable' as const,
    };

    expect(
      deriveActionCenterItems({
        computerStatuses: [status],
        acknowledgedActionIds: ['computer:bridge-1:unavailable'],
      }),
    ).toHaveLength(1);
  });

  it('removes only locally acknowledged action versions', () => {
    const session = cloudSession({ updated_at: 100 });
    const [item] = deriveActionCenterItems({ cloudSessions: [session] });
    expect(item).toBeDefined();
    if (!item) throw new Error('Expected an actionable session item');
    expect(
      deriveActionCenterItems({
        cloudSessions: [session],
        acknowledgedActionIds: [item.id],
      }),
    ).toEqual([]);
    expect(
      deriveActionCenterItems({
        cloudSessions: [cloudSession({ updated_at: 101 })],
        acknowledgedActionIds: [item.id],
      }),
    ).toHaveLength(1);
  });
});
