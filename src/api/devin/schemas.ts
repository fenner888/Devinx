/**
 * Zod schemas for every Devin API v3 endpoint used by DevinX v1 (spec §8.5).
 * Generated from live docs.devin.ai reference (OpenAPI contract refreshed 2026-07-17).
 *
 * Boundary validation rule (spec §8.3): every API response parses through
 * these schemas. Unknown fields PASS THROUGH (API evolves monthly); missing
 * REQUIRED fields fail closed with a typed `ApiSchemaError` passed through the
 * local diagnostic boundary without logging user data.
 *
 * The `.passthrough()` on object schemas enforces the "unknown fields ok"
 * rule. Required fields are non-optional; optional fields use `.nullish()`.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives & enums
// ---------------------------------------------------------------------------

export const cursorSchema = z.string();
export const unixTimestampSchema = z.number().int();
export const acuCountSchema = z.number().min(0);
/**
 * Devin's current v3 reference documents `org-...`, while some live
 * organization accounts expose the legacy `org_...` form. Preserve the
 * server-issued identifier exactly; authenticated API validation remains the
 * source of truth.
 */
export const orgIdSchema = z
  .string()
  .min(5)
  .max(128)
  .regex(/^org[-_][A-Za-z0-9]+$/);
export const devinIdSchema = z.string().regex(/^devin-/);

export const sessionStatusSchema = z.enum([
  'new',
  'claimed',
  'running',
  'exit',
  'error',
  'suspended',
  'resuming',
]);

export const sessionStatusDetailSchema = z.enum([
  'working',
  'waiting_for_user',
  'waiting_for_approval',
  'finished',
  'inactivity',
  'user_request',
  'usage_limit_exceeded',
  'out_of_credits',
  'out_of_quota',
  // Additional billing/limit states in the live contract.
  'no_quota_allocation',
  'payment_declined',
  'org_usage_limit_exceeded',
  'total_session_limit_exceeded',
  'error',
]);

/** status_detail can carry values beyond the known enum — never fail on it. */
export const sessionStatusDetailLoose = z.string();

export const sessionOriginSchema = z.enum([
  'webapp',
  'slack',
  'teams',
  'api',
  'linear',
  'jira',
  'automation',
  'cli',
  'desktop',
  'code_scan',
  'other',
]);

export const sessionCategorySchema = z.enum([
  'bug_fixing',
  'ci_cd_and_devops',
  'code_quality_and_security',
  'code_review',
  'code_review_and_analysis',
  'data_and_automation',
  'documentation_and_content',
  'feature_development',
  'migrations_and_upgrades',
  'other',
  'refactoring_and_optimization',
  'research_and_exploration',
  'security',
  'unit_test_generation',
]);

export const devinModeSchema = z.enum(['normal', 'fast', 'lite', 'ultra', 'fusion']);
export const sessionSizeSchema = z.enum(['xs', 's', 'm', 'l', 'xl']);
export const insightSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const secretTypeSchema = z.enum(['cookie', 'key-value', 'totp']);
export const accessTypeSchema = z.enum(['enterprise', 'org', 'personal']);
export const prStateSchema = z.enum(['open', 'merged', 'closed', 'draft']);
export const messageSourceSchema = z.enum(['devin', 'user']);

// ---------------------------------------------------------------------------
// Pagination envelope (generic)
// ---------------------------------------------------------------------------

/**
 * Per-item salvage: one malformed item must not blank an entire list
 * (fail-closed at the item level, fail-open at the page level). Dropped
 * items are logged in dev; the page still renders everything valid.
 */
export const salvageArraySchema = <T extends z.ZodTypeAny>(item: T) =>
  z.array(z.unknown()).transform((arr) => {
    const valid: z.infer<T>[] = [];
    let dropped = 0;
    for (const raw of arr) {
      const parsed = item.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
      else dropped++;
    }
    if (dropped > 0 && typeof console !== 'undefined') {
      console.warn(`[schemas] dropped ${dropped} invalid item(s) from a list response`);
    }
    return valid;
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      end_cursor: cursorSchema.nullable(),
      has_next_page: z.boolean().default(false),
      items: salvageArraySchema(item),
      total: z.number().nullable().optional(),
    })
    .passthrough();

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const pullRequestSchema = z
  .object({
    pr_state: z.string().nullable(),
    pr_url: z.string(),
    draft: z.boolean().optional(),
    state: prStateSchema.optional(),
    merged_at: unixTimestampSchema.nullable().optional(),
    closed: z.number().optional(),
  })
  .passthrough();

export const sessionSecretInputSchema = z
  .object({
    key: z.string().min(1).max(256),
    value: z.string().max(65_536),
    sensitive: z.boolean().optional(),
  })
  .strict();

export const sessionCreateRequestSchema = z
  .object({
    prompt: z.string().min(1),
    attachment_urls: z.array(z.string().url().min(1).max(2083)).nullable().optional(),
    bypass_approval: z.boolean().nullable().optional(),
    child_playbook_id: z.string().nullable().optional(),
    create_as_user_id: z.string().nullable().optional(),
    devin_mode: devinModeSchema.nullable().optional(),
    knowledge_ids: z.array(z.string()).nullable().optional(),
    max_acu_limit: z.number().int().nullable().optional(),
    platform: z.string().min(1).nullable().optional(),
    playbook_id: z.string().nullable().optional(),
    repos: z.array(z.string()).nullable().optional(),
    resumable: z.boolean().optional(),
    secret_ids: z.array(z.string()).nullable().optional(),
    session_links: z.array(z.string()).nullable().optional(),
    session_secrets: z.array(sessionSecretInputSchema).nullable().optional(),
    structured_output_required: z.boolean().nullable().optional(),
    structured_output_schema: z.record(z.unknown()).nullable().optional(),
    tags: z.array(z.string()).max(50).nullable().optional(),
    title: z.string().nullable().optional(),
  })
  .strict();

export const sessionResponseSchema = z
  .object({
    acus_consumed: acuCountSchema,
    // These are nullable AND may be omitted entirely (not in the contract's
    // required set) — use nullish so a missing key doesn't fail the parse.
    category: sessionCategorySchema.nullish(),
    child_session_ids: z.array(z.string()).nullish(),
    created_at: unixTimestampSchema,
    is_archived: z.boolean().default(false),
    org_id: z.string(),
    origin: sessionOriginSchema.nullish(),
    parent_session_id: z.string().nullish(),
    playbook_id: z.string().nullish(),
    pull_requests: z.array(pullRequestSchema),
    service_user_id: z.string().nullish(),
    user_id: z.string().nullish(),
    session_id: z.string(),
    status: sessionStatusSchema,
    // Accept any string — status_detail carries billing/limit values that
    // drift beyond the known enum.
    status_detail: sessionStatusDetailLoose.nullish(),
    structured_output: z.record(z.unknown()).nullish(),
    tags: z.array(z.string()),
    title: z.string().nullish(),
    updated_at: unixTimestampSchema,
    url: z.string(),
    subcategory: z.string().nullable().optional(),
    // Web-app-only enrichment fields (best-effort, all optional).
    latest_status_contents: z
      .object({
        enum: z.string().max(80).optional(),
        reason: z.string().max(500).optional(),
        user_action_required: z.string().max(500).optional(),
      })
      .nullable()
      .optional(),
    latest_status_event_at: unixTimestampSchema.nullable().optional(),
    latest_permission_contents: z
      .object({
        type: z.string().optional(),
        tool_name: z.string().max(160).optional(),
        permission_type: z.string().max(160).optional(),
      })
      .nullable()
      .optional(),
    latest_permission_event_at: unixTimestampSchema.nullable().optional(),
    latest_loop_contents: z.object({ type: z.string().optional() }).nullable().optional(),
    latest_loop_event_at: unixTimestampSchema.nullable().optional(),
    latest_approval_contents: z.object({ type: z.string().optional() }).nullable().optional(),
    latest_approval_event_at: unixTimestampSchema.nullable().optional(),
    current_activity_changed_at: unixTimestampSchema.nullable().optional(),
    activity_status_changed_at: unixTimestampSchema.nullable().optional(),
    is_unread: z.boolean().optional(),
  })
  .passthrough();

export const sessionsQueryParamsSchema = z
  .object({
    after: cursorSchema.nullable().optional(),
    category: sessionCategorySchema.nullable().optional(),
    created_after: unixTimestampSchema.nullable().optional(),
    created_before: unixTimestampSchema.nullable().optional(),
    first: z.number().int().min(1).max(200).default(100),
    is_archived: z.boolean().nullable().optional(),
    origins: z.array(sessionOriginSchema).nullable().optional(),
    playbook_id: z.string().nullable().optional(),
    repo_names: z.array(z.string()).nullable().optional(),
    schedule_id: z.string().nullable().optional(),
    service_user_ids: z.array(z.string()).nullable().optional(),
    session_ids: z.array(z.string()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    updated_after: unixTimestampSchema.nullable().optional(),
    updated_before: unixTimestampSchema.nullable().optional(),
    user_ids: z.array(z.string()).nullable().optional(),
  })
  .strict();

export const sessionListResponseSchema = paginatedResponseSchema(sessionResponseSchema);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const sessionMessageSchema = z
  .object({
    created_at: unixTimestampSchema,
    event_id: z.string(),
    message: z.string(),
    source: messageSourceSchema,
  })
  .passthrough();

export const sessionMessageListResponseSchema = paginatedResponseSchema(sessionMessageSchema);

export const sessionMessageCreateRequestSchema = z
  .object({
    message: z.string().min(1),
    attachment_urls: z.array(z.string().url().min(1).max(2083)).nullable().optional(),
    message_as_user_id: z.string().nullable().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const sessionTagsUpdateRequestSchema = z
  .object({
    tags: z.array(z.string()).max(50),
  })
  .strict();

export const sessionTagsResponseSchema = z
  .object({
    tags: z.array(z.string()),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export const insightsGenerateResponseSchema = z
  .object({
    // Contract types this as a plain string (no enum) — don't hard-fail.
    status: z.string(),
  })
  .passthrough();

export const insightActionItemSchema = z
  .object({
    action_item: z.string(),
    issue_id: z.string().nullable().optional().default(null),
    type: z.string().optional().default('other'),
  })
  .passthrough();

export const insightClassificationSchema = z
  .object({
    category: z.string(),
    confidence: z.number(),
    programming_languages: z.array(z.string()).optional().default([]),
    tools_and_frameworks: z.array(z.string()).optional().default([]),
  })
  .passthrough();

export const insightIssueSchema = z
  .object({
    id: z.string().optional().default(''),
    impact: z.string(),
    issue: z.string(),
    label: z.string(),
  })
  .passthrough();

export const insightSuggestedPromptSchema = z
  .object({
    feedback_items: z.array(z.unknown()).optional().default([]),
    original_prompt: z.string(),
    suggested_prompt: z.string(),
  })
  .passthrough();

export const insightTimelineEntrySchema = z
  .object({
    color: z.string().optional().default(''),
    description: z.string(),
    issue_id: z.string().nullable().optional().default(null),
    title: z.string(),
  })
  .passthrough();

export const sessionInsightsAnalysisSchema = z
  .object({
    action_items: z.array(insightActionItemSchema).optional().default([]),
    classification: insightClassificationSchema.nullable().optional().default(null),
    issues: z.array(insightIssueSchema).optional().default([]),
    note_usage: z.unknown().nullable().optional().default(null),
    suggested_prompt: insightSuggestedPromptSchema.nullable().optional().default(null),
    timeline: z.array(insightTimelineEntrySchema).optional().default([]),
  })
  .passthrough();

// Tolerant per the real contract: `analysis` is NOT required (absent until
// generated), session_size/status are loosened to strings, and only IDs +
// core counts are mandatory.
export const sessionInsightsResponseSchema = z
  .object({
    session_id: z.string(),
    org_id: z.string(),
    url: z.string(),
    num_devin_messages: z.number().optional().default(0),
    num_user_messages: z.number().optional().default(0),
    session_size: z.string().nullable().optional(),
    status: z.string().optional(),
    acus_consumed: acuCountSchema.optional().default(0),
    created_at: unixTimestampSchema.optional(),
    updated_at: unixTimestampSchema.optional(),
    tags: z.array(z.string()).optional().default([]),
    pull_requests: z.array(pullRequestSchema).optional().default([]),
    analysis: sessionInsightsAnalysisSchema.nullable().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const playbookResponseSchema = z
  .object({
    playbook_id: z.string(),
    title: z.string(),
    body: z.string(),
    macro: z.string().nullable(),
    access_type: z.enum(['enterprise', 'org']),
    created_at: unixTimestampSchema,
    created_by: z.string(),
    org_id: z.string().nullable(),
    structured_output_schema: z.record(z.unknown()).nullable().optional(),
    updated_at: unixTimestampSchema,
    updated_by: z.string(),
  })
  .passthrough();

export const playbookListResponseSchema = paginatedResponseSchema(playbookResponseSchema);

// Matches the real v3 KnowledgeNoteResponse: it has NO created_by/updated_by
// (requiring them dropped every real note), and includes folder_path + macro.
// Non-essential metadata is optional so shape drift can't blank the screen.
export const knowledgeNoteResponseSchema = z
  .object({
    note_id: z.string(),
    name: z.string(),
    body: z.string(),
    trigger: z.string(),
    access_type: z.enum(['enterprise', 'org']),
    created_at: unixTimestampSchema,
    updated_at: unixTimestampSchema,
    folder_id: z.string().nullable(),
    folder_path: z.string(),
    is_enabled: z.boolean(),
    macro: z.string().nullable(),
    org_id: z.string().nullable(),
    pinned_repo: z.string().nullable(),
  })
  .passthrough();

export const knowledgeNoteListResponseSchema = paginatedResponseSchema(knowledgeNoteResponseSchema);

export const knowledgeFolderSummarySchema = z
  .object({
    folder_id: z.string(),
    name: z.string(),
    note_count: z.number().int().nonnegative(),
    parent_folder_id: z.string().nullable(),
    path: z.string(),
  })
  .passthrough();

export const knowledgeFolderTreeSchema = z
  .object({
    folders: z.array(knowledgeFolderSummarySchema),
    root_note_count: z.number().int().nonnegative(),
  })
  .passthrough();

// The real SecretResponse has no org_id; keep metadata optional.
export const secretResponseSchema = z
  .object({
    secret_id: z.string(),
    key: z.string().nullable(),
    note: z.string().nullable(),
    secret_type: secretTypeSchema,
    access_type: z.enum(['org', 'personal']),
    created_at: unixTimestampSchema,
    created_by: z.string(),
    is_sensitive: z.boolean(),
    updated_at: unixTimestampSchema.nullable().optional(),
    updated_by: z.string().nullable().optional(),
  })
  .strip();
// SECURITY: secret values are never returned by the list endpoint. This schema
// intentionally omits any `value` field and strips unknown keys so an upstream
// regression cannot place secret material in the query cache (spec §10.2).

export const secretListResponseSchema = paginatedResponseSchema(secretResponseSchema);

export const userSchema = z
  .object({
    user_id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
  })
  .passthrough();

export const userListResponseSchema = paginatedResponseSchema(userSchema);

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const attachmentResponseSchema = z
  .object({
    attachment_id: z.string(),
    name: z.string(),
    url: z.string().url(),
  })
  .passthrough();

export const sessionAttachmentSchema = attachmentResponseSchema.extend({
  source: z.enum(['devin', 'user']),
  content_type: z.string().nullable().optional(),
});

export const sessionAttachmentListSchema = z.array(sessionAttachmentSchema);

// ---------------------------------------------------------------------------
// Consumption
// ---------------------------------------------------------------------------

/**
 * GET /v3/organizations/{org_id}/consumption/daily returns an ENVELOPE
 * (per the v3 OpenAPI spec):
 *   { total_acus: number, consumption_by_date: [{ date, acus, acus_by_product }] }
 * where `date` is a unix INTEGER (midnight PST = 08:00 UTC) and product
 * values can be null (e.g. `review`). Product keys stay open-ended.
 */
export const consumptionByDateSchema = z
  .object({
    date: z.union([z.number(), z.string()]),
    acus: acuCountSchema.optional(),
    acus_by_product: z.record(z.number().nullable()).optional().default({}),
  })
  .passthrough();

export const consumptionResponseSchema = z
  .object({
    total_acus: z.number().optional(),
    consumption_by_date: z.array(consumptionByDateSchema),
  })
  .passthrough();

export const consumptionCycleSchema = z
  .object({
    after: unixTimestampSchema,
    before: unixTimestampSchema,
  })
  .passthrough();

export const consumptionCycleListResponseSchema = paginatedResponseSchema(consumptionCycleSchema);

export const devinAcuLimitSchema = z
  .object({
    cycle_acu_limit: acuCountSchema,
    scope: z.enum(['enterprise', 'org', 'user']),
    org_id: z.string().nullable().optional(),
    user_id: z.string().nullable().optional(),
  })
  .passthrough();

export const devinAcuLimitListResponseSchema = paginatedResponseSchema(devinAcuLimitSchema);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const apiErrorDetailSchema = z.object({
  loc: z.array(z.string()),
  msg: z.string(),
  type: z.string(),
});

export const apiErrorResponseSchema = z.object({
  detail: z.union([z.array(apiErrorDetailSchema), z.string()]),
});

// ---------------------------------------------------------------------------
// Schedules (Automations)
// ---------------------------------------------------------------------------

export const scheduleResponseSchema = z
  .object({
    // The API calls the sched- ID `scheduled_session_id`; accept either name.
    schedule_id: z.string().optional(),
    scheduled_session_id: z.string().optional(),
    name: z.string(),
    prompt: z.string(),
    enabled: z.boolean(),
    schedule_type: z.enum(['recurring', 'one_time']).catch('recurring'),
    frequency: z.string().nullable().optional(),
    scheduled_at: z.string().nullable().optional(),
    agent: z.enum(['devin', 'data_analyst']),
    bypass_approval: z.boolean().optional(),
    interval_count: z.number().int().positive().optional(),
    notify_on: z.enum(['always', 'failure', 'never']),
    platform: z.string().nullable().optional(),
    playbook: z.object({ playbook_id: z.string(), title: z.string().nullable() }).nullable(),
    slack_channel_id: z.string().nullable().optional(),
    slack_team_id: z.string().nullable().optional(),
    target_devin_id: z.string().nullable().optional(),
    consecutive_failures: z.number().int(),
    created_by: z.string().nullable(),
    last_edited_by: z.string().nullable().optional(),
    last_error_at: z.string().datetime({ offset: true }).nullable(),
    last_executed_at: z.string().datetime({ offset: true }).nullable(),
    last_error_message: z.string().nullable(),
    org_id: z.string(),
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    tags: z.array(z.string()).nullable().optional(),
  })
  .passthrough()
  // Fail closed: without an ID, PATCH/DELETE would target the collection path.
  .refine((s) => !!(s.schedule_id || s.scheduled_session_id), {
    message: 'schedule has no schedule_id/scheduled_session_id',
  });

export const scheduleListResponseSchema = paginatedResponseSchema(scheduleResponseSchema);

// ---------------------------------------------------------------------------
// PR Reviews (Devin Review)
// ---------------------------------------------------------------------------

export const prReviewResponseSchema = z
  .object({
    status: z.enum(['pending', 'running', 'completed', 'errored', 'cancelled']),
    repo_path: z.string(),
    pr_number: z.number(),
    commit_sha: z.string(),
    created_at: z.string(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Resource management requests (outbound validation)
// ---------------------------------------------------------------------------

export const knowledgeNoteCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(100_000),
    trigger: z.string().trim().min(1).max(5_000),
    folder_id: z.string().min(1).max(256).nullable().optional(),
    is_enabled: z.boolean().nullable().optional(),
    pinned_repo: z.string().min(1).max(1_024).nullable().optional(),
  })
  .strict();

export const knowledgeNoteUpdateRequestSchema = knowledgeNoteCreateRequestSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'update is empty' });

export const playbookCreateRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(100_000),
    macro: z
      .string()
      .regex(/^![A-Za-z0-9_-]+$/)
      .max(100)
      .nullable()
      .optional(),
    structured_output_schema: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export const playbookUpdateRequestSchema = playbookCreateRequestSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'update is empty' });

export const secretCreateRequestSchema = z
  .object({
    type: secretTypeSchema,
    key: z.string().trim().min(1).max(256),
    value: z.string().min(1).max(100_000),
    note: z.string().max(2_000).nullable().optional(),
    is_sensitive: z.boolean().optional(),
  })
  .strict();

export const resourceIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9._:-]+$/);

const scheduleCreateFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    prompt: z.string().trim().min(1).max(10_000),
    schedule_type: z.enum(['recurring', 'one_time']).optional(),
    frequency: z.string().trim().min(1).max(256).nullable().optional(),
    scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
    playbook_id: resourceIdSchema.nullable().optional(),
    notify_on: z.enum(['always', 'failure', 'never']).optional(),
    agent: z.enum(['devin', 'data_analyst']).optional(),
    bypass_approval: z.boolean().optional(),
    interval_count: z.number().int().positive().optional(),
    platform: z.string().trim().min(1).max(256).nullable().optional(),
    slack_channel_id: resourceIdSchema.nullable().optional(),
    slack_team_id: resourceIdSchema.nullable().optional(),
    target_devin_id: resourceIdSchema.nullable().optional(),
  })
  .strict();

export const scheduleCreateRequestSchema = scheduleCreateFieldsSchema
  .extend({
    create_as_user_id: resourceIdSchema.nullable().optional(),
  })
  .superRefine((body, context) => {
    const type = body.schedule_type ?? 'recurring';
    if (type === 'recurring' && !body.frequency) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'frequency is required' });
    }
    if (type === 'one_time' && !body.scheduled_at) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'scheduled_at is required' });
    }
  });

export const scheduleUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).nullable().optional(),
    prompt: z.string().trim().min(1).max(10_000).nullable().optional(),
    enabled: z.boolean().nullable().optional(),
    schedule_type: z.enum(['recurring', 'one_time']).nullable().optional(),
    frequency: z.string().trim().min(1).max(256).nullable().optional(),
    scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
    playbook_id: resourceIdSchema.nullable().optional(),
    notify_on: z.enum(['always', 'failure', 'never']).nullable().optional(),
    agent: z.enum(['devin', 'data_analyst']).nullable().optional(),
    bypass_approval: z.boolean().nullable().optional(),
    interval_count: z.number().int().positive().nullable().optional(),
    platform: z.string().trim().min(1).max(256).nullable().optional(),
    run_as_user_id: resourceIdSchema.nullable().optional(),
    slack_channel_id: resourceIdSchema.nullable().optional(),
    slack_team_id: resourceIdSchema.nullable().optional(),
    target_devin_id: resourceIdSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'update is empty' });

// ---------------------------------------------------------------------------
// Org metrics (Analytics)
// ---------------------------------------------------------------------------

// Metrics can legitimately be null for sparse ranges (e.g. avg over zero
// sessions) — normalize null/missing to 0 instead of failing the screen.
const metricCount = z
  .number()
  .nullable()
  .optional()
  .transform((v) => v ?? 0);

const countRecordSchema = z
  .record(z.number().nullable())
  .optional()
  .default({})
  .transform((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? 0])));

export const sessionMetricsSchema = z
  .object({
    sessions_created_count: metricCount,
    sessions_created_by_size: countRecordSchema,
    sessions_created_by_origin: countRecordSchema,
    sessions_created_with_playbook_count: metricCount,
    sessions_created_with_search_count: metricCount,
    sessions_with_merged_prs_count: metricCount,
    sessions_with_merged_prs_by_size: countRecordSchema,
    avg_acus_per_session: metricCount,
  })
  .passthrough();

export const prMetricsSchema = z
  .object({
    prs_created_count: metricCount,
    prs_opened_count: metricCount,
    prs_merged_count: metricCount,
    prs_closed_count: metricCount,
  })
  .passthrough();

export const searchMetricsSchema = z.object({ searches_created_count: metricCount }).passthrough();

export const activeUserPeriodSchema = z
  .object({
    start_time: z.number().int(),
    end_time: z.number().int(),
    active_users: z.number().int().nonnegative(),
  })
  .passthrough();

export const activeUserMetricsSchema = activeUserPeriodSchema;

// The list may arrive bare or wrapped in an items envelope.
export const activeUsersResponseSchema = z.array(activeUserPeriodSchema);

// ---------------------------------------------------------------------------
// Repositories (v3beta1)
// ---------------------------------------------------------------------------

const repositoryIndexJobSchema = z
  .object({
    branch_name: z.string(),
    commit: z.string(),
    created_at: z.union([z.number(), z.string()]),
    job_id: z.string(),
  })
  .passthrough();

const repositoryIndexingStatusSchema = z
  .object({
    indexing_enabled: z.boolean().optional().default(false),
    latest_completed_search_index_job: repositoryIndexJobSchema.nullable().optional(),
    latest_completed_wiki_index_job: repositoryIndexJobSchema.nullable().optional(),
    latest_indexes: z.array(repositoryIndexJobSchema).optional().default([]),
  })
  .passthrough();

export const repositoryResponseSchema = z
  .object({
    provider_repository_id: z.string(),
    git_connection_id: z.string(),
    git_connection_host: z.string(),
    repo_name: z.string(),
    repo_path: z.string(),
    repo_description: z.string().nullable().optional(),
    repo_language: z.string().nullable().optional(),
    last_updated_at: z.union([z.string(), z.number()]).nullable().optional(),
    indexing_status: repositoryIndexingStatusSchema.nullable().optional(),
  })
  .passthrough();

export const repositoryListResponseSchema = paginatedResponseSchema(repositoryResponseSchema);

// ---------------------------------------------------------------------------
// Self / identity
// ---------------------------------------------------------------------------

export const selfResponseSchema = z
  .object({
    principal_type: z.string().optional(),
    org_id: z.string().optional(),
    service_user_id: z.string().optional(),
    service_user_name: z.string().optional(),
    user_id: z.string().optional(),
    api_key_id: z.string().optional(),
    api_key_name: z.string().optional(),
  })
  .passthrough();
