/**
 * Endpoint tests — the layer where every "won't load" bug originated
 * (session-ID prefixing, consumption envelope, message attribution). Mocks
 * the auth provider + fetch and asserts path building and response shaping.
 */
import {
  getSession,
  sendMessage,
  getDailyConsumption,
  listSessions,
  getSessionConsumption,
} from '../../src/api/devin/endpoints';
import { clearRateLimit } from '../../src/api/devin/client';
import type { AuthProvider } from '../../src/auth/AuthProvider';

const mockAuth: AuthProvider = {
  kind: 'service_user',
  authHeaders: async () => ({ Authorization: 'Bearer cog_test' }),
  orgPath: async () => '/v3/organizations/org-abc',
  sessionAttribution: async () => ({ create_as_user_id: 'user-42' }),
  validate: async () => ({ ok: true }),
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function ok(data: unknown) {
  return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(data), json: async () => data };
}

function lastUrl(): string {
  return mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
}
function lastBody(): unknown {
  const init = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1] as { body?: string };
  return init.body ? JSON.parse(init.body) : undefined;
}

const sessionFixture = {
  acus_consumed: 1,
  category: null,
  child_session_ids: null,
  created_at: 1,
  is_archived: false,
  org_id: 'org-abc',
  origin: 'api',
  parent_session_id: null,
  playbook_id: null,
  pull_requests: [],
  service_user_id: null,
  session_id: 'devin-abc',
  status: 'running',
  status_detail: 'working',
  tags: [],
  title: 't',
  updated_at: 2,
  url: 'https://app.devin.ai/sessions/devin-abc',
};

beforeEach(() => {
  mockFetch.mockReset();
  clearRateLimit();
});

describe('endpoints — path building & response shaping', () => {
  it('getSession prefixes a bare session_id with devin- in the URL path', async () => {
    mockFetch.mockResolvedValue(ok(sessionFixture));
    await getSession(mockAuth, 'abc123'); // bare id (as the API returns it)
    expect(lastUrl()).toContain('/sessions/devin-abc123');
  });

  it('getSession does not double-prefix an already-prefixed id', async () => {
    mockFetch.mockResolvedValue(ok(sessionFixture));
    await getSession(mockAuth, 'devin-abc123');
    expect(lastUrl()).toContain('/sessions/devin-abc123');
    expect(lastUrl()).not.toContain('devin-devin-');
  });

  it('sendMessage maps attribution to message_as_user_id (not create_as_user_id)', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, headers: new Headers(), text: async () => '', json: async () => undefined });
    await sendMessage(mockAuth, 'devin-abc', 'hello');
    const body = lastBody() as Record<string, unknown>;
    expect(body.message_as_user_id).toBe('user-42');
    expect(body.create_as_user_id).toBeUndefined();
  });

  it('getDailyConsumption normalizes the envelope (unix date → YYYY-MM-DD, null products → 0)', async () => {
    mockFetch.mockResolvedValue(
      ok({
        total_acus: 5,
        consumption_by_date: [
          { date: 1751875200, acus: 5, acus_by_product: { devin: 5, review: null } },
        ],
      }),
    );
    const days = await getDailyConsumption(mockAuth);
    expect(days).toHaveLength(1);
    expect(days[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(days[0]?.acus_by_product.review).toBe(0);
  });

  it('getSessionConsumption returns total_acus', async () => {
    mockFetch.mockResolvedValue(ok({ total_acus: 3.5, consumption_by_date: [] }));
    const total = await getSessionConsumption(mockAuth, 'devin-abc');
    expect(total).toBe(3.5);
    expect(lastUrl()).toContain('/consumption/daily/sessions/devin-abc');
  });

  it('listSessions unwraps the paginated items envelope', async () => {
    mockFetch.mockResolvedValue(ok({ items: [sessionFixture], end_cursor: null, has_next_page: false }));
    const { items, hasNextPage } = await listSessions(mockAuth, { first: 100 });
    expect(items).toHaveLength(1);
    expect(hasNextPage).toBe(false);
  });
});
