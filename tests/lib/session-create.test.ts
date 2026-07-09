import type { SessionResponse } from '../../src/api/devin/types';
import { findPotentialCreatedSession } from '../../src/lib/session-create';

function session(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    acus_consumed: 0,
    category: null,
    child_session_ids: null,
    created_at: 100,
    is_archived: false,
    org_id: 'org-1',
    origin: 'api',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: [],
    service_user_id: 'service-1',
    session_id: 'session-1',
    status: 'new',
    tags: [],
    title: 'Fix uploads',
    updated_at: 100,
    url: 'https://app.devin.ai/sessions/session-1',
    ...overrides,
  };
}

describe('retry-safe session reconciliation', () => {
  it('finds one API session created after the request started', () => {
    expect(
      findPotentialCreatedSession(
        { prompt: 'Fix uploads', title: 'Fix uploads' },
        [session()],
        100,
        { service_user_id: 'service-1' },
      )?.session_id,
    ).toBe('session-1');
  });

  it('rejects sessions with a different title, origin, or older timestamp', () => {
    expect(
      findPotentialCreatedSession(
        { prompt: 'Fix uploads', title: 'Fix uploads' },
        [
          session({ session_id: 'wrong-title', title: 'Other' }),
          session({ session_id: 'wrong-origin', origin: 'webapp' }),
          session({ session_id: 'too-old', created_at: 90 }),
        ],
        100,
        { service_user_id: 'service-1' },
      ),
    ).toBeUndefined();
  });

  it('does not guess when multiple recent untitled API sessions exist', () => {
    expect(
      findPotentialCreatedSession(
        { prompt: 'Fix uploads' },
        [session({ session_id: 'one', title: null }), session({ session_id: 'two', title: null })],
        100,
        { service_user_id: 'service-1' },
      ),
    ).toBeUndefined();
  });

  it('does not reconcile without a verified identity or across service users', () => {
    expect(
      findPotentialCreatedSession({ prompt: 'Fix uploads' }, [session()], 100),
    ).toBeUndefined();
    expect(
      findPotentialCreatedSession({ prompt: 'Fix uploads' }, [session()], 100, {
        service_user_id: 'other-service',
      }),
    ).toBeUndefined();
  });
});
