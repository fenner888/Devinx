/**
 * Session utils tests — status derivation, sorting, sectioning, filtering.
 */

import {
  deriveStatusKey,
  sortSessions,
  sectionSessions,
  filterBySearch,
  filterByTags,
  collectTags,
  relativeTime,
  prNumber,
  removeSessionFromBoard,
} from '../../src/lib/session-utils';
import type { SessionResponse } from '../../src/api/devin/types';

function makeSession(overrides: Partial<SessionResponse> = {}): SessionResponse {
  return {
    acus_consumed: 0,
    category: null,
    child_session_ids: null,
    created_at: 1000,
    is_archived: false,
    org_id: 'org-test',
    origin: 'api',
    parent_session_id: null,
    playbook_id: null,
    pull_requests: [],
    service_user_id: null,
    session_id: 'devin-test',
    status: 'running',
    status_detail: 'working',
    tags: [],
    title: 'Test session',
    updated_at: 2000,
    url: 'https://app.devin.ai/sessions/devin-test',
    ...overrides,
  };
}

describe('session-utils', () => {
  describe('deriveStatusKey', () => {
    it('returns crashed for error status', () => {
      expect(deriveStatusKey(makeSession({ status: 'error' }))).toBe('crashed');
    });

    it('returns done for finished with no PRs', () => {
      expect(deriveStatusKey(makeSession({ status: 'exit', status_detail: 'finished' }))).toBe(
        'done',
      );
    });

    it('returns prReady for finished with open PR', () => {
      expect(
        deriveStatusKey(
          makeSession({
            status: 'exit',
            status_detail: 'finished',
            pull_requests: [
              { pr_state: 'open', pr_url: 'https://github.com/repo/pull/42', state: 'open' },
            ],
          }),
        ),
      ).toBe('prReady');
    });

    it('returns done for finished with merged PR', () => {
      expect(
        deriveStatusKey(
          makeSession({
            status: 'exit',
            status_detail: 'finished',
            pull_requests: [
              {
                pr_state: 'merged',
                pr_url: 'https://github.com/repo/pull/42',
                state: 'merged',
                merged_at: 1500,
              },
            ],
          }),
        ),
      ).toBe('done');
    });

    it('returns waitingForResponse for waiting_for_user', () => {
      expect(deriveStatusKey(makeSession({ status_detail: 'waiting_for_user' }))).toBe(
        'waitingForResponse',
      );
    });

    it('returns approvalRequired for waiting_for_approval', () => {
      expect(deriveStatusKey(makeSession({ status_detail: 'waiting_for_approval' }))).toBe(
        'approvalRequired',
      );
    });

    it('returns exceededLimit for usage_limit_exceeded', () => {
      expect(
        deriveStatusKey(
          makeSession({ status: 'suspended', status_detail: 'usage_limit_exceeded' }),
        ),
      ).toBe('exceededLimit');
    });

    it('returns sleeping for inactivity', () => {
      expect(
        deriveStatusKey(makeSession({ status: 'suspended', status_detail: 'inactivity' })),
      ).toBe('sleeping');
    });

    it('returns working for running with working detail', () => {
      expect(deriveStatusKey(makeSession({ status: 'running', status_detail: 'working' }))).toBe(
        'working',
      );
    });
  });

  describe('removeSessionFromBoard', () => {
    it('removes the archived session across prefixed and bare API ids', () => {
      const sessions = [
        makeSession({ session_id: 'devin-archive-me' }),
        makeSession({ session_id: 'keep-me' }),
      ];

      expect(
        removeSessionFromBoard(sessions, 'archive-me')?.map((session) => session.session_id),
      ).toEqual(['keep-me']);
    });
  });

  describe('sortSessions', () => {
    it('sorts blocked-first (needs input before working)', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', status_detail: 'working', updated_at: 3000 }),
        makeSession({ session_id: 'devin-b', status_detail: 'waiting_for_user', updated_at: 1000 }),
      ];
      const sorted = sortSessions(sessions);
      expect(sorted[0]!.session_id).toBe('devin-b'); // waiting_for_user first
    });

    it('sorts by updated_at within same priority', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', status_detail: 'working', updated_at: 1000 }),
        makeSession({ session_id: 'devin-b', status_detail: 'working', updated_at: 2000 }),
      ];
      const sorted = sortSessions(sessions);
      expect(sorted[0]!.session_id).toBe('devin-b'); // newer first
    });
  });

  describe('sectionSessions', () => {
    it('groups sessions into sections', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', status_detail: 'waiting_for_user' }),
        makeSession({ session_id: 'devin-b', status_detail: 'working' }),
        makeSession({ session_id: 'devin-c', status: 'exit', status_detail: 'finished' }),
      ];
      const sections = sectionSessions(sessions);
      expect(sections).toHaveLength(3);
      expect(sections[0]!.section).toBe('needs_input');
      expect(sections[1]!.section).toBe('working');
      expect(sections[2]!.section).toBe('recent');
    });

    it('sorts pinned sessions first within their section', () => {
      const sessions = [
        makeSession({ session_id: 'devin-new', status_detail: 'working', updated_at: 2000 }),
        makeSession({ session_id: 'devin-pinned', status_detail: 'working', updated_at: 1000 }),
      ];
      const sections = sectionSessions(sessions, ['devin-pinned']);
      expect(sections[0]!.data.map((session) => session.session_id)).toEqual([
        'devin-pinned',
        'devin-new',
      ]);
    });

    it('skips empty sections', () => {
      const sessions = [makeSession({ session_id: 'devin-a', status_detail: 'working' })];
      const sections = sectionSessions(sessions);
      expect(sections).toHaveLength(1);
      expect(sections[0]!.section).toBe('working');
    });
  });

  describe('filterBySearch', () => {
    it('filters by title', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', title: 'Fix login bug' }),
        makeSession({ session_id: 'devin-b', title: 'Add tests' }),
      ];
      expect(filterBySearch(sessions, 'login')).toHaveLength(1);
    });

    it('filters by tag', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', tags: ['urgent', 'bug'] }),
        makeSession({ session_id: 'devin-b', tags: ['feature'] }),
      ];
      expect(filterBySearch(sessions, 'urgent')).toHaveLength(1);
    });

    it('returns all for empty query', () => {
      const sessions = [makeSession(), makeSession({ session_id: 'devin-b' })];
      expect(filterBySearch(sessions, '')).toHaveLength(2);
    });
  });

  describe('filterByTags', () => {
    it('filters by single tag', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', tags: ['bug', 'urgent'] }),
        makeSession({ session_id: 'devin-b', tags: ['feature'] }),
      ];
      expect(filterByTags(sessions, ['bug'])).toHaveLength(1);
    });

    it('AND logic — must have all selected tags', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', tags: ['bug', 'urgent'] }),
        makeSession({ session_id: 'devin-b', tags: ['bug'] }),
      ];
      expect(filterByTags(sessions, ['bug', 'urgent'])).toHaveLength(1);
    });

    it('returns all for no tags', () => {
      const sessions = [makeSession(), makeSession({ session_id: 'devin-b' })];
      expect(filterByTags(sessions, [])).toHaveLength(2);
    });
  });

  describe('collectTags', () => {
    it('collects unique tags sorted by frequency', () => {
      const sessions = [
        makeSession({ session_id: 'devin-a', tags: ['bug', 'urgent'] }),
        makeSession({ session_id: 'devin-b', tags: ['bug'] }),
        makeSession({ session_id: 'devin-c', tags: ['feature'] }),
      ];
      const tags = collectTags(sessions);
      expect(tags[0]).toEqual({ tag: 'bug', count: 2 });
      expect(tags[1]).toEqual({ tag: 'urgent', count: 1 });
      expect(tags[2]).toEqual({ tag: 'feature', count: 1 });
    });
  });

  describe('relativeTime', () => {
    it('returns just now for recent', () => {
      const now = Date.now() / 1000;
      expect(relativeTime(now - 30)).toBe('just now');
    });

    it('returns minutes ago', () => {
      const now = Date.now() / 1000;
      expect(relativeTime(now - 120)).toBe('2m ago');
    });

    it('returns hours ago', () => {
      const now = Date.now() / 1000;
      expect(relativeTime(now - 7200)).toBe('2h ago');
    });
  });

  describe('prNumber', () => {
    it('extracts PR number from URL', () => {
      expect(prNumber('https://github.com/repo/pull/42')).toBe('42');
    });

    it('returns PR for malformed URL', () => {
      expect(prNumber('not-a-url')).toBe('PR');
    });
  });
});
