/**
 * API schema boundary tests (§8.3) — every endpoint's response schema parses
 * a representative fixture and rejects malformed required fields.
 */

import {
  sessionResponseSchema,
  sessionListResponseSchema,
  sessionMessageSchema,
  sessionMessageListResponseSchema,
  sessionTagsResponseSchema,
  insightsGenerateResponseSchema,
  sessionInsightsResponseSchema,
  playbookResponseSchema,
  knowledgeNoteResponseSchema,
  secretResponseSchema,
  attachmentResponseSchema,
  consumptionResponseSchema,
  sessionCreateRequestSchema,
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
  it('parses a valid SessionResponse and passes through unknown fields', () => {
    const out = sessionResponseSchema.parse({ ...sessionFixture, future_field: 'ok' });
    expect(out.session_id).toBe('devin-123');
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
    for (const k of ['category', 'origin', 'child_session_ids', 'parent_session_id', 'playbook_id', 'service_user_id', 'status_detail', 'title']) {
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
        action: ['wrote tests'],
        classification: 'feature',
        issues: [{ description: 'd', severity: 'low', title: 't' }],
        prompts: null,
        timeline: [{ description: 'd', title: 't' }],
      },
    });
    expect(out.analysis?.issues[0]?.severity).toBe('low');
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
      is_enabled: true,
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

  it('parses a secret WITHOUT a value field (values never returned)', () => {
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
      updated_at: 2,
      updated_by: 'u',
    });
    expect(out.key).toBe('GITHUB_TOKEN');
    expect((out as Record<string, unknown>).value).toBeUndefined();
  });

  it('parses an attachment response', () => {
    const out = attachmentResponseSchema.parse({
      attachment_id: 'a1',
      name: 'file.txt',
      url: 'https://example.com/file.txt',
    });
    expect(out.attachment_id).toBe('a1');
  });

  it('salvages a list page when one item is malformed instead of failing the page', () => {
    const page = sessionListResponseSchema.parse({
      end_cursor: null,
      has_next_page: false,
      items: [
        sessionFixture,
        { session_id: 'broken', title: 'missing every required field' },
      ],
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

  it('parses a session create request with all optional fields', () => {
    const out = sessionCreateRequestSchema.parse({
      prompt: 'fix the bug',
      tags: ['mobile'],
      max_acu_limit: 10,
      unlisted: true,
    });
    expect(out.prompt).toBe('fix the bug');
    expect(out.unlisted).toBe(true);
  });

  it('rejects a session create request without a prompt', () => {
    expect(() => sessionCreateRequestSchema.parse({ tags: ['x'] })).toThrow();
  });
});
