/**
 * API schema boundary tests (§8.3) — every endpoint's response schema parses
 * a representative fixture and rejects malformed required fields.
 */

import {
  orgIdSchema,
  sessionResponseSchema,
  sessionListResponseSchema,
  sessionMessageSchema,
  sessionMessageListResponseSchema,
  sessionMessageCreateRequestSchema,
  sessionTagsResponseSchema,
  sessionTagsUpdateRequestSchema,
  insightsGenerateResponseSchema,
  sessionInsightsResponseSchema,
  playbookResponseSchema,
  knowledgeNoteResponseSchema,
  secretResponseSchema,
  attachmentResponseSchema,
  consumptionResponseSchema,
  consumptionCycleListResponseSchema,
  devinAcuLimitListResponseSchema,
  sessionCreateRequestSchema,
  repositoryResponseSchema,
  knowledgeFolderTreeSchema,
  knowledgeNoteCreateRequestSchema,
  knowledgeNoteUpdateRequestSchema,
  playbookCreateRequestSchema,
  scheduleCreateRequestSchema,
  scheduleResponseSchema,
  scheduleUpdateRequestSchema,
  secretCreateRequestSchema,
  sessionAttachmentListSchema,
  activeUserMetricsSchema,
  activeUsersResponseSchema,
} from '../../src/api/devin/schemas';

const sessionFixture = {
  acus_consumed: 1.5,
  category: 'feature_development',
  child_session_ids: null,
  created_at: 1719500000,
  is_archived: false,
  org_id: 'org-abc',
  origin: 'api',
  parent_session_id: null,
  playbook_id: null,
  pull_requests: [{ pr_state: 'open', pr_url: 'https://github.com/x/y/pull/1' }],
  service_user_id: null,
  session_id: 'devin-123',
  status: 'running',
  status_detail: 'working',
  tags: ['mobile'],
  title: 'Fix the bug',
  updated_at: 1719500100,
  url: 'https://app.devin.ai/sessions/devin-123',
};

describe('API schema boundary validation (§8.3)', () => {
  it('accepts both server-issued organization ID separators without rewriting them', () => {
    expect(orgIdSchema.parse('org-abc123')).toBe('org-abc123');
    expect(orgIdSchema.parse('org_abc123')).toBe('org_abc123');
  });

  it('rejects malformed organization IDs', () => {
    for (const value of ['orgabc123', 'org/abc123', 'org-', 'org_', 'other-abc123']) {
      expect(orgIdSchema.safeParse(value).success).toBe(false);
    }
  });

  it('parses a valid SessionResponse and passes through unknown fields', () => {
    const out = sessionResponseSchema.parse({
      ...sessionFixture,
      structured_output: { summary: 'Done', tests: ['npm test'] },
      future_field: 'ok',
    });
    expect(out.session_id).toBe('devin-123');
    expect(out.structured_output).toEqual({ summary: 'Done', tests: ['npm test'] });
    expect((out as Record<string, unknown>).future_field).toBe('ok');
  });

  it('rejects a SessionResponse missing a required field', () => {
    const bad = { ...sessionFixture } as Partial<typeof sessionFixture>;
    delete bad.status;
    expect(() => sessionResponseSchema.parse(bad)).toThrow();
  });

  it('accepts an unlisted status_detail and a null pr_state (contract drift)', () => {
    const out = sessionResponseSchema.parse({
      ...sessionFixture,
      status: 'suspended',
      status_detail: 'org_usage_limit_exceeded', // not in the original enum
      pull_requests: [{ pr_state: null, pr_url: 'not-a-url' }],
    });
    expect(out.status_detail).toBe('org_usage_limit_exceeded');
    expect(out.pull_requests[0]?.pr_state).toBeNull();
  });

  it('tolerates optional nullable session fields being omitted entirely', () => {
    const minimal = { ...sessionFixture } as Record<string, unknown>;
    for (const k of [
      'category',
      'origin',
      'child_session_ids',
      'parent_session_id',
      'playbook_id',
      'service_user_id',
      'status_detail',
      'title',
    ]) {
      delete minimal[k];
    }
    expect(() => sessionResponseSchema.parse(minimal)).not.toThrow();
  });

  it('parses a paginated session list', () => {
    const out = sessionListResponseSchema.parse({
      end_cursor: 'cur1',
      has_next_page: true,
      items: [sessionFixture],
      total: 1,
    });
    expect(out.items).toHaveLength(1);
    expect(out.has_next_page).toBe(true);
  });

  it('parses a message with source=devin', () => {
    const out = sessionMessageSchema.parse({
      created_at: 1719500000,
      event_id: 'evt1',
      message: 'Working on it',
      source: 'devin',
    });
    expect(out.source).toBe('devin');
  });

  it('rejects a message with an invalid source', () => {
    expect(() =>
      sessionMessageSchema.parse({
        created_at: 1,
        event_id: 'e',
        message: 'hi',
        source: 'invalid',
      }),
    ).toThrow();
  });

  it('parses a message list response', () => {
    const out = sessionMessageListResponseSchema.parse({
      end_cursor: null,
      has_next_page: false,
      items: [],
    });
    expect(out.items).toHaveLength(0);
  });

  it('parses tags response', () => {
    expect(sessionTagsResponseSchema.parse({ tags: ['a', 'b'] }).tags).toEqual(['a', 'b']);
  });

  it('parses insights generate response', () => {
    expect(insightsGenerateResponseSchema.parse({ status: 'started' }).status).toBe('started');
  });

  it('parses a full insights response', () => {
    const out = sessionInsightsResponseSchema.parse({
      acus_consumed: 2.0,
      created_at: 1,
      num_devin_messages: 5,
      num_user_messages: 2,
      org_id: 'org-x',
      pull_requests: [],
      session_id: 'devin-1',
      session_size: 'm',
      status: 'exit',
      tags: [],
      updated_at: 2,
      url: 'https://app.devin.ai/sessions/devin-1',
      analysis: {
        action_items: [
          { action_item: 'Write focused tests', issue_id: 'issue-1', type: 'knowledge' },
        ],
        classification: {
          category: 'feature_development',
          confidence: 0.91,
          programming_languages: ['TypeScript'],
          tools_and_frameworks: ['React Native'],
        },
        issues: [
          { id: 'issue-1', impact: 'Slow feedback', issue: 'Polling lag', label: 'Latency' },
        ],
        note_usage: null,
        suggested_prompt: {
          feedback_items: [],
          original_prompt: 'Fix it',
          suggested_prompt: 'Fix it and add focused tests',
        },
        timeline: [
          { color: 'blue', description: 'Implemented fix', issue_id: null, title: 'Code' },
        ],
      },
    });
    expect(out.analysis?.classification?.category).toBe('feature_development');
    expect(out.analysis?.issues[0]?.issue).toBe('Polling lag');
  });

  it('parses insights without an analysis block (not generated yet)', () => {
    const out = sessionInsightsResponseSchema.parse({
      session_id: 'devin-1',
      org_id: 'org-abc',
      url: 'https://app.devin.ai/sessions/devin-1',
      num_devin_messages: 3,
      num_user_messages: 2,
      tags: [],
      pull_requests: [],
    });
    expect(out.analysis == null).toBe(true);
    expect(out.session_id).toBe('devin-1');
  });

  it('parses a playbook', () => {
    const out = playbookResponseSchema.parse({
      access_type: 'org',
      body: 'Do the thing',
      created_at: 1,
      created_by: 'u1',
      macro: null,
      org_id: 'org-1',
      playbook_id: 'pb1',
      structured_output_schema: null,
      title: 'My playbook',
      updated_at: 2,
      updated_by: 'u2',
    });
    expect(out.title).toBe('My playbook');
  });

  it('parses a knowledge note', () => {
    const out = knowledgeNoteResponseSchema.parse({
      access_type: 'org',
      body: 'note',
      created_at: 1,
      created_by: 'u',
      folder_id: null,
      folder_path: '',
      is_enabled: true,
      macro: null,
      name: 'My note',
      note_id: 'n1',
      org_id: 'org-1',
      pinned_repo: null,
      trigger: 'manual',
      updated_at: 2,
      updated_by: 'u',
    });
    expect(out.name).toBe('My note');
  });

  it('parses bounded repository indexing status', () => {
    const out = repositoryResponseSchema.parse({
      provider_repository_id: 'provider-repo-1',
      git_connection_id: 'connection-1',
      git_connection_host: 'github.com',
      repo_name: 'DevinX',
      repo_path: 'fenner888/DevinX',
      indexing_status: {
        indexing_enabled: true,
        latest_completed_wiki_index_job: {
          branch_name: 'main',
          commit: 'abc123',
          created_at: 1_700_000_000,
          job_id: 'job-1',
        },
      },
    });
    expect(out.indexing_status?.latest_completed_wiki_index_job?.branch_name).toBe('main');
  });

  it('strips an unexpected secret value before data can enter the query cache', () => {
    const out = secretResponseSchema.parse({
      access_type: 'org',
      created_at: 1,
      created_by: 'u',
      is_sensitive: true,
      key: 'GITHUB_TOKEN',
      note: null,
      org_id: 'org-1',
      secret_id: 's1',
      secret_type: 'key-value',
      value: 'must-never-survive-response-parsing',
      updated_at: 2,
      updated_by: 'u',
    });
    expect(out.key).toBe('GITHUB_TOKEN');
    expect((out as Record<string, unknown>).value).toBeUndefined();
  });

  it('parses a Knowledge folder tree and rejects negative note counts', () => {
    const fixture = {
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
    };
    expect(knowledgeFolderTreeSchema.parse(fixture).folders[0]?.name).toBe('Engineering');
    expect(() =>
      knowledgeFolderTreeSchema.parse({ ...fixture, root_note_count: -1 }),
    ).toThrow();
  });

  it('parses an attachment response', () => {
    const out = attachmentResponseSchema.parse({
      attachment_id: 'a1',
      name: 'file.txt',
      url: 'https://example.com/file.txt',
    });
    expect(out.attachment_id).toBe('a1');
  });

  it('parses documented session output attachments', () => {
    const out = sessionAttachmentListSchema.parse([
      {
        attachment_id: 'a1',
        name: 'report.md',
        url: 'https://example.com/report.md',
        source: 'devin',
        content_type: 'text/markdown',
      },
    ]);
    expect(out[0]).toEqual(expect.objectContaining({ name: 'report.md', source: 'devin' }));
  });

  it('parses the documented active-user metric shapes', () => {
    const period = { start_time: 1, end_time: 2, active_users: 3 };
    expect(activeUserMetricsSchema.parse(period).active_users).toBe(3);
    expect(activeUsersResponseSchema.parse([period])).toEqual([period]);
  });

  it('salvages a list page when one item is malformed instead of failing the page', () => {
    const page = sessionListResponseSchema.parse({
      end_cursor: null,
      has_next_page: false,
      items: [sessionFixture, { session_id: 'broken', title: 'missing every required field' }],
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.session_id).toBe(sessionFixture.session_id);
  });

  it('parses the real daily-consumption envelope (unix dates, nullable products)', () => {
    const out = consumptionResponseSchema.parse({
      total_acus: 12.5,
      consumption_by_date: [
        {
          date: 1751875200, // unix seconds — NOT a string
          acus: 3.5,
          acus_by_product: { devin: 3.0, cascade: 0.5, terminal: 0, review: null },
        },
      ],
    });
    expect(out.consumption_by_date[0]?.acus).toBe(3.5);
    expect(out.consumption_by_date[0]?.acus_by_product.review).toBeNull();
  });

  it('tolerates unknown products and missing totals in the envelope', () => {
    const out = consumptionResponseSchema.parse({
      consumption_by_date: [
        { date: 1751875200, acus_by_product: { devin: 2, deepwiki: 0.25 } },
        { date: '2026-07-07' },
      ],
    });
    expect(out.total_acus).toBeUndefined();
    expect(out.consumption_by_date[0]?.acus_by_product.deepwiki).toBe(0.25);
    expect(out.consumption_by_date[1]?.acus_by_product).toEqual({});
  });

  it('parses enterprise consumption cycles using after/before timestamps', () => {
    const out = consumptionCycleListResponseSchema.parse({
      items: [{ after: 1751342400, before: 1754020800 }],
      end_cursor: null,
      has_next_page: false,
    });
    expect(out.items[0]).toEqual(expect.objectContaining({ after: 1751342400, before: 1754020800 }));
  });

  it('parses organization ACU limits with the documented scope discriminator', () => {
    const out = devinAcuLimitListResponseSchema.parse({
      items: [{ cycle_acu_limit: 250, scope: 'org', org_id: 'org-abc' }],
      end_cursor: null,
      has_next_page: false,
    });
    expect(out.items[0]?.cycle_acu_limit).toBe(250);
  });

  it('parses a session create request with all optional fields', () => {
    const out = sessionCreateRequestSchema.parse({
      prompt: 'fix the bug',
      tags: ['mobile'],
      max_acu_limit: 10,
      platform: 'gitpod',
      resumable: true,
      session_links: ['https://example.com/issue/1'],
      structured_output_required: true,
      structured_output_schema: { type: 'object' },
    });
    expect(out.prompt).toBe('fix the bug');
    expect(out.resumable).toBe(true);
    expect(out.structured_output_required).toBe(true);
  });

  it.each(['normal', 'fast', 'lite', 'ultra', 'fusion'] as const)(
    'accepts documented Cloud mode %s',
    (devinMode) => {
      expect(
        sessionCreateRequestSchema.parse({ prompt: 'Try it.', devin_mode: devinMode }).devin_mode,
      ).toBe(devinMode);
    },
  );

  it('rejects removed create-session fields instead of silently sending stale contract data', () => {
    expect(() =>
      sessionCreateRequestSchema.parse({ prompt: 'Try it.', unlisted: true }),
    ).toThrow();
    expect(() =>
      sessionCreateRequestSchema.parse({ prompt: 'Try it.', snapshot_id: 'snapshot-1' }),
    ).toThrow();
  });

  it('rejects fractional ACU limits', () => {
    expect(() =>
      sessionCreateRequestSchema.parse({ prompt: 'Try it.', max_acu_limit: 1.5 }),
    ).toThrow();
  });

  it('rejects a session create request without a prompt', () => {
    expect(() => sessionCreateRequestSchema.parse({ tags: ['x'] })).toThrow();
  });

  it('rejects undocumented keys in message and tag writes', () => {
    expect(() =>
      sessionMessageCreateRequestSchema.parse({ message: 'Hello', create_as_user_id: 'user-1' }),
    ).toThrow();
    expect(() => sessionTagsUpdateRequestSchema.parse({ tags: ['release'], replace: true })).toThrow();
  });

  it('strictly validates resource writes and rejects empty updates', () => {
    expect(() =>
      knowledgeNoteCreateRequestSchema.parse({
        name: 'Rules',
        trigger: 'Always',
        body: 'Use strict TypeScript.',
        unexpected: true,
      }),
    ).toThrow();
    expect(() => knowledgeNoteUpdateRequestSchema.parse({})).toThrow();
    expect(() => playbookCreateRequestSchema.parse({ title: 'Bad', body: 'x', macro: 'bad' })).toThrow();
    expect(
      playbookCreateRequestSchema.parse({
        title: 'Structured',
        body: 'Return JSON.',
        structured_output_schema: { type: 'object' },
      }).structured_output_schema,
    ).toEqual({ type: 'object' });
    expect(() =>
      secretCreateRequestSchema.parse({ type: 'key-value', key: 'TOKEN', value: '' }),
    ).toThrow();
  });

  it('requires schedule timing fields and rejects unsupported write agents', () => {
    expect(() =>
      scheduleCreateRequestSchema.parse({
        name: 'Recurring',
        prompt: 'Check dependencies.',
        schedule_type: 'recurring',
      }),
    ).toThrow();
    expect(() =>
      scheduleCreateRequestSchema.parse({
        name: 'Advanced',
        prompt: 'Check dependencies.',
        schedule_type: 'recurring',
        frequency: '0 9 * * *',
        agent: 'advanced',
      }),
    ).toThrow();
    expect(() => scheduleUpdateRequestSchema.parse({})).toThrow();
  });

  it('accepts the documented advanced schedule contract without exposing unsafe controls in UI', () => {
    const created = scheduleCreateRequestSchema.parse({
      name: 'Windows check',
      prompt: 'Run the checks.',
      schedule_type: 'recurring',
      frequency: '0 9 * * *',
      interval_count: 1,
      platform: 'windows',
      create_as_user_id: 'user-1',
      bypass_approval: false,
      slack_channel_id: 'channel-1',
      slack_team_id: 'team-1',
      target_devin_id: 'devin-1',
    });
    expect(created.platform).toBe('windows');
    expect(
      scheduleUpdateRequestSchema.parse({
        run_as_user_id: null,
        platform: 'linux',
        enabled: null,
        notify_on: null,
      }),
    ).toEqual({ run_as_user_id: null, platform: 'linux', enabled: null, notify_on: null });
    expect(() =>
      scheduleCreateRequestSchema.parse({
        name: 'Invalid create',
        prompt: 'Run the checks.',
        schedule_type: 'recurring',
        frequency: '0 9 * * *',
        bypass_approval: null,
      }),
    ).toThrow();
  });

  it('requires the documented ScheduleResponse fields', () => {
    const response = {
      scheduled_session_id: 'sched-1',
      org_id: 'org-test',
      created_by: null,
      name: 'Daily check',
      prompt: 'Run the checks.',
      playbook: null,
      frequency: '0 9 * * *',
      enabled: true,
      last_executed_at: null,
      created_at: '2026-07-17T12:00:00Z',
      updated_at: '2026-07-17T12:00:00Z',
      last_error_at: null,
      last_error_message: null,
      consecutive_failures: 0,
      notify_on: 'failure',
      agent: 'devin',
    };
    expect(scheduleResponseSchema.parse(response).scheduled_session_id).toBe('sched-1');
    expect(() => scheduleResponseSchema.parse({ ...response, org_id: undefined })).toThrow();
  });
});
