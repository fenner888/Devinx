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
  listRepositories,
  listKnowledge,
  listKnowledgeFolders,
  listConsumptionCycles,
  listDevinAcuLimits,
  getCodeScanMetrics,
  remediateFinding,
} from '../../src/api/devin/endpoints';
import { clearRateLimit } from '../../src/api/devin/client';
import type { AuthProvider } from '../../src/auth/AuthProvider';

const mockAuth: AuthProvider = {
  kind: 'service_user',
  authHeaders: async () => ({ Authorization: 'Bearer cog_test' }),
  orgPath: async () => '/v3/organizations/org-abc',
  credentialFingerprint: async () => 'test',
  sessionAttribution: async () => ({ create_as_user_id: 'user-42' }),
  validate: async () => ({ ok: true }),
};

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function ok(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(data),
    json: async () => data,
  };
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

const repositoryFixture = {
  provider_repository_id: 'provider-repo-1',
  git_connection_id: 'connection-1',
  git_connection_host: 'github.com',
  repo_name: 'DevinX',
  repo_path: 'fenner888/DevinX',
  repo_description: null,
  repo_language: 'TypeScript',
  last_updated_at: null,
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

  it('sendMessage maps attribution and returns the resumed session', async () => {
    mockFetch.mockResolvedValue(ok({ ...sessionFixture, status: 'resuming' }));
    const resumed = await sendMessage(mockAuth, 'devin-abc', 'hello');
    const body = lastBody() as Record<string, unknown>;
    expect(body.message_as_user_id).toBe('user-42');
    expect(body.create_as_user_id).toBeUndefined();
    expect(resumed.status).toBe('resuming');
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

  it('listConsumptionCycles uses the read-only enterprise billing endpoint', async () => {
    mockFetch.mockResolvedValue(
      ok({
        items: [{ after: 1751342400, before: 1754020800 }],
        end_cursor: null,
        has_next_page: false,
      }),
    );
    const cycles = await listConsumptionCycles(mockAuth);
    expect(cycles).toHaveLength(1);
    expect(lastUrl()).toContain('/v3/enterprise/consumption/cycles');
  });

  it('listDevinAcuLimits follows pagination and preserves organization scope', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({
          items: [{ cycle_acu_limit: 100, org_id: 'org-other' }],
          end_cursor: 'next-limits-page',
          has_next_page: true,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [{ cycle_acu_limit: 250, org_id: 'org-abc' }],
          end_cursor: null,
          has_next_page: false,
        }),
      );
    const limits = await listDevinAcuLimits(mockAuth);
    expect(limits).toHaveLength(2);
    expect(limits[1]?.org_id).toBe('org-abc');
    expect(lastUrl()).toContain('/v3/enterprise/consumption/acu-limits/devin');
  });

  it('listSessions unwraps the paginated items envelope', async () => {
    mockFetch.mockResolvedValue(
      ok({ items: [sessionFixture], end_cursor: null, has_next_page: false }),
    );
    const { items, hasNextPage } = await listSessions(mockAuth, { first: 100 });
    expect(items).toHaveLength(1);
    expect(hasNextPage).toBe(false);
  });

  it('gets code-scan metrics with a validated bounded UTC range', async () => {
    mockFetch.mockResolvedValue(
      ok({
        scans_count: 1,
        repos_scanned_count: 1,
        prs_created_count: 0,
        prs_open_count: 0,
        prs_merged_count: 0,
        prs_closed_count: 0,
        avg_pr_time_to_merge_seconds: null,
        avg_pr_open_duration_seconds: null,
        open_critical_findings_count: 0,
        open_high_findings_count: 0,
        open_medium_findings_count: 0,
        open_low_findings_count: 0,
      }),
    );

    await getCodeScanMetrics(mockAuth, { timeAfter: 100, timeBefore: 200 });

    const url = new URL(lastUrl());
    expect(url.pathname).toBe('/v3/enterprise/code-scans/metrics');
    expect(url.searchParams.get('time_after')).toBe('100');
    expect(url.searchParams.get('time_before')).toBe('200');
  });

  it('binds remediation responses to the requested finding', async () => {
    mockFetch.mockResolvedValue(ok({ finding_id: 'finding-1', session_id: 'session-1' }));

    await expect(remediateFinding(mockAuth, 'scan-1', 'finding-1')).resolves.toEqual({
      finding_id: 'finding-1',
      session_id: 'session-1',
    });
    expect(lastUrl()).toContain('/code-scans/scan-1/findings/finding-1/remediate');

    mockFetch.mockResolvedValue(ok({ finding_id: 'different-finding', session_id: 'session-2' }));
    await expect(remediateFinding(mockAuth, 'scan-1', 'finding-1')).rejects.toThrow(
      'did not match the requested finding',
    );
  });

  it('listRepositories follows every cursor and removes duplicate repository identities', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ items: [repositoryFixture], end_cursor: 'repository-page-2', has_next_page: true }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [
            repositoryFixture,
            {
              ...repositoryFixture,
              provider_repository_id: 'provider-repo-2',
              repo_name: 'Push',
              repo_path: 'fenner888/Push',
            },
          ],
          end_cursor: null,
          has_next_page: false,
        }),
      );

    const repositories = await listRepositories(mockAuth);

    expect(repositories.map((repository) => repository.repo_path)).toEqual([
      'fenner888/DevinX',
      'fenner888/Push',
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(new URL(mockFetch.mock.calls[0]?.[0] as string).searchParams.has('after')).toBe(false);
    expect(new URL(mockFetch.mock.calls[1]?.[0] as string).searchParams.get('after')).toBe(
      'repository-page-2',
    );
  });

  it('listKnowledge follows continuation cursors and returns complete history', async () => {
    const note = {
      note_id: 'note-1',
      name: 'Release rules',
      body: 'Run all release gates.',
      trigger: 'Before release',
      folder_id: null,
    };
    mockFetch
      .mockResolvedValueOnce(
        ok({ items: [note], end_cursor: 'knowledge-page-2', has_next_page: true }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [{ ...note, note_id: 'note-2', name: 'Security rules' }],
          end_cursor: null,
          has_next_page: false,
        }),
      );

    await expect(listKnowledge(mockAuth)).resolves.toHaveLength(2);
    expect(new URL(mockFetch.mock.calls[1]?.[0] as string).searchParams.get('after')).toBe(
      'knowledge-page-2',
    );
  });

  it('listKnowledge rejects a repeated cursor instead of returning partial notes', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ items: [], end_cursor: 'repeat-knowledge', has_next_page: true }),
      )
      .mockResolvedValueOnce(
        ok({ items: [], end_cursor: 'repeat-knowledge', has_next_page: true }),
      );

    await expect(listKnowledge(mockAuth)).rejects.toThrow(
      'Knowledge pagination returned an invalid cursor',
    );
  });

  it('listKnowledgeFolders validates the organization folder tree', async () => {
    mockFetch.mockResolvedValue(
      ok({
        folders: [
          {
            folder_id: 'folder-1',
            name: 'Engineering',
            note_count: 2,
            parent_folder_id: null,
            path: 'Engineering',
          },
        ],
        root_note_count: 3,
      }),
    );

    await expect(listKnowledgeFolders(mockAuth)).resolves.toMatchObject({
      root_note_count: 3,
      folders: [{ folder_id: 'folder-1', note_count: 2 }],
    });
    expect(new URL(lastUrl()).pathname).toBe('/v3/organizations/org-abc/knowledge/folders');
  });

  it('listRepositories rejects repeated continuation cursors instead of returning a partial list', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({ items: [repositoryFixture], end_cursor: 'repeat', has_next_page: true }),
      )
      .mockResolvedValueOnce(ok({ items: [], end_cursor: 'repeat', has_next_page: true }));

    await expect(listRepositories(mockAuth)).rejects.toThrow(
      'Repository pagination returned an invalid cursor',
    );
  });

  it('listRepositories fails closed when the reviewed page bound is exceeded', async () => {
    mockFetch.mockImplementation(async () =>
      ok({
        items: [],
        end_cursor: `cursor-${mockFetch.mock.calls.length}`,
        has_next_page: true,
      }),
    );

    await expect(listRepositories(mockAuth)).rejects.toThrow(
      'Repository list exceeds the supported pagination limit',
    );
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });
});
