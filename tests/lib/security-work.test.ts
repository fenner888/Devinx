import type { SessionResponse } from '../../src/api/devin/types';
import {
  groupSecurityWork,
  isSecurityWorkSession,
  isVerifiedCodeScanRoot,
} from '../../src/lib/security-work';

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
    title: 'Session',
    updated_at: 1,
    url: 'https://app.devin.ai/sessions/session-1',
    ...overrides,
  };
}

describe('Security Work session model', () => {
  it('uses only top-level sessions with the canonical code_scan origin', () => {
    const verifiedScan = session({
      origin: 'code_scan',
      title: 'Perform security scan on fenner888/Push',
    });

    expect(isVerifiedCodeScanRoot(verifiedScan)).toBe(true);
    expect(isSecurityWorkSession(verifiedScan)).toBe(true);
    expect(isSecurityWorkSession(session({ origin: 'code_scan', title: 'Untitled scan' }))).toBe(
      true,
    );
    expect(isSecurityWorkSession(session({ tags: ['DevinX-Security-Work'] }))).toBe(false);
    expect(isSecurityWorkSession(session({ tags: ['security-review'] }))).toBe(false);
    expect(isSecurityWorkSession(session({ category: 'code_quality_and_security' }))).toBe(false);
    expect(isSecurityWorkSession(session({ category: 'security' }))).toBe(false);
    expect(
      isSecurityWorkSession(
        session({ origin: 'code_scan', parent_session_id: 'scan-coordinator' }),
      ),
    ).toBe(false);
    expect(
      isSecurityWorkSession(session({ origin: 'api', title: 'Security scan fenner888/Push' })),
    ).toBe(false);
    expect(isSecurityWorkSession(session({ title: 'Fix security settings' }))).toBe(false);
    expect(isSecurityWorkSession(session({ tags: ['security-adjacent'] }))).toBe(false);
  });

  it('groups uncategorized child agents beneath a security coordinator', () => {
    const root = session({
      session_id: 'root',
      origin: 'code_scan',
      title: 'Security scan fenner888/Push',
      child_session_ids: ['child-a', 'child-b'],
      updated_at: 10,
    });
    const childA = session({
      session_id: 'child-a',
      parent_session_id: 'root',
      updated_at: 30,
    });
    const childB = session({
      session_id: 'child-b',
      parent_session_id: 'root',
      updated_at: 20,
    });
    const unrelated = session({ session_id: 'other', updated_at: 100 });

    expect(groupSecurityWork([unrelated, childB, root, childA])).toEqual([
      {
        root,
        workers: [childA, childB],
        updatedAt: 30,
      },
    ]);
  });

  it('does not surface orphan workers or tagged ordinary sessions as scan roots', () => {
    const worker = session({
      session_id: 'worker',
      parent_session_id: 'unavailable-parent',
      tags: ['devinx-security-work'],
    });
    const taggedReview = session({
      session_id: 'tagged-review',
      tags: ['devinx-security-work', 'security-review'],
    });

    expect(groupSecurityWork([worker, taggedReview])).toEqual([]);
  });
});
