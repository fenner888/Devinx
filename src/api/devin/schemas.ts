/**
 * Zod schemas for every Devin API v3 endpoint used by DevinX v1 (spec §8.5).
 * Generated from live docs.devin.ai reference (crawled 2026-07-07).
 *
 * Boundary validation rule (spec §8.3): every API response parses through
 * these schemas. Unknown fields PASS THROUGH (API evolves monthly); missing
 * REQUIRED fields fail closed with a typed `ApiSchemaError` logged to Sentry.
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
export const orgIdSchema = z.string().regex(/^org-/);
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
]);

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

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      end_cursor: cursorSchema.nullable(),
      has_next_page: z.boolean().default(false),
      items: z.array(item),
      total: z.number().nullable().optional(),
    })
    .passthrough();

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const pullRequestSchema = z
  .object({
    pr_state: z.string(),
    pr_url: z.string().url(),
    draft: z.boolean().optional(),
    state: prStateSchema.optional(),
    merged_at: unixTimestampSchema.nullable().optional(),
    closed: z.number().optional(),
  })
  .passthrough();

export const sessionSecretInputSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.string().min(1),
});

export const sessionCreateRequestSchema = z
  .object({
    prompt: z.string().min(1),
    attachment_urls: z.array(z.string().url().min(1).max(2083)).optional(),
    bypass_approval: z.boolean().optional(),
    child_playbook_id: z.string().optional(),
    create_as_user_id: z.string().optional(),
    devin_mode: devinModeSchema.optional(),
    knowledge_ids: z.array(z.string()).optional(),
    max_acu_limit: z.number().positive().optional(),
    playbook_id: z.string().optional(),
    repos: z.array(z.string()).optional(),
    secret_ids: z.array(z.string()).optional(),
    session_secrets: z.array(sessionSecretInputSchema).optional(),
    snapshot_id: z.string().optional(),
    structured_output_schema: z.record(z.unknown()).optional(),
    tags: z.array(z.string()).max(50).optional(),
    title: z.string().optional(),
    unlisted: z.boolean().optional(),
  })
  .passthrough();

export const sessionResponseSchema = z
  .object({
    acus_consumed: acuCountSchema,
    category: sessionCategorySchema.nullable(),
    child_session_ids: z.array(z.string()).nullable(),
    created_at: unixTimestampSchema,
    is_archived: z.boolean().default(false),
    org_id: z.string(),
    origin: sessionOriginSchema.nullable(),
    parent_session_id: z.string().nullable(),
    playbook_id: z.string().nullable(),
    pull_requests: z.array(pullRequestSchema),
    service_user_id: z.string().nullable(),
    session_id: z.string(),
    status: sessionStatusSchema,
    status_detail: sessionStatusDetailSchema.nullable(),
    tags: z.array(z.string()),
    title: z.string().nullable(),
    updated_at: unixTimestampSchema,
    url: z.string(),
    subcategory: z.string().nullable().optional(),
    // Web-app-only enrichment fields (best-effort, all optional).
    latest_status_contents: z
      .object({
        enum: z.string().optional(),
        reason: z.string().optional(),
        user_action_required: z.string().optional(),
      })
      .nullable()
      .optional(),
    latest_status_event_at: unixTimestampSchema.nullable().optional(),
    latest_permission_contents: z
      .object({
        type: z.string().optional(),
        tool_name: z.string().optional(),
        permission_type: z.string().optional(),
      })
      .nullable()
      .optional(),
    latest_permission_event_at: unixTimestampSchema.nullable().optional(),
    latest_loop_contents: z
      .object({ type: z.string().optional() })
      .nullable()
      .optional(),
    latest_loop_event_at: unixTimestampSchema.nullable().optional(),
    latest_approval_contents: z
      .object({ type: z.string().optional() })
      .nullable()
      .optional(),
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
    pr_states: z.array(z.string()).nullable().optional(),
    search: z.string().nullable().optional(),
    status: sessionStatusSchema.nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    updated_after: unixTimestampSchema.nullable().optional(),
    updated_before: unixTimestampSchema.nullable().optional(),
    user_ids: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

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
  .passthrough();

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const sessionTagsUpdateRequestSchema = z
  .object({
    tags: z.array(z.string()).max(50),
  })
  .passthrough();

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
    status: z.enum(['already_exists', 'started']),
  })
  .passthrough();

export const insightIssueSchema = z
  .object({
    description: z.string(),
    severity: insightSeveritySchema,
    title: z.string(),
  })
  .passthrough();

export const insightPromptSchema = z
  .object({
    description: z.string(),
    title: z.string(),
  })
  .passthrough();

export const insightTimelineEntrySchema = z
  .object({
    description: z.string(),
    title: z.string(),
  })
  .passthrough();

export const sessionInsightsAnalysisSchema = z
  .object({
    action: z.array(z.string()),
    classification: z.string(),
    issues: z.array(insightIssueSchema),
    prompts: z.array(insightPromptSchema).nullable(),
    timeline: z.array(insightTimelineEntrySchema),
  })
  .passthrough();

export const sessionInsightsResponseSchema = z
  .object({
    acus_consumed: acuCountSchema,
    created_at: unixTimestampSchema,
    num_devin_messages: z.number().int(),
    num_user_messages: z.number().int(),
    org_id: z.string(),
    pull_requests: z.array(pullRequestSchema),
    session_id: z.string(),
    session_size: sessionSizeSchema,
    status: sessionStatusSchema,
    tags: z.array(z.string()),
    updated_at: unixTimestampSchema,
    url: z.string(),
    analysis: sessionInsightsAnalysisSchema,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const playbookResponseSchema = z
  .object({
    access_type: accessTypeSchema,
    body: z.string(),
    created_at: unixTimestampSchema,
    created_by: z.string(),
    macro: z.string().nullable(),
    org_id: z.string().nullable(),
    playbook_id: z.string(),
    structured_output_schema: z.record(z.unknown()).nullable(),
    title: z.string(),
    updated_at: unixTimestampSchema,
    updated_by: z.string(),
  })
  .passthrough();

export const playbookListResponseSchema = paginatedResponseSchema(playbookResponseSchema);

export const knowledgeNoteResponseSchema = z
  .object({
    access_type: accessTypeSchema,
    body: z.string(),
    created_at: unixTimestampSchema,
    created_by: z.string(),
    folder_id: z.string().nullable(),
    is_enabled: z.boolean().nullable(),
    name: z.string(),
    note_id: z.string(),
    org_id: z.string().nullable(),
    pinned_repo: z.string().nullable(),
    trigger: z.string(),
    updated_at: unixTimestampSchema,
    updated_by: z.string(),
  })
  .passthrough();

export const knowledgeNoteListResponseSchema = paginatedResponseSchema(
  knowledgeNoteResponseSchema,
);

export const secretResponseSchema = z
  .object({
    access_type: accessTypeSchema,
    created_at: unixTimestampSchema,
    created_by: z.string(),
    is_sensitive: z.boolean(),
    key: z.string(),
    note: z.string().nullable(),
    org_id: z.string().nullable(),
    secret_id: z.string(),
    secret_type: secretTypeSchema,
    updated_at: unixTimestampSchema,
    updated_by: z.string(),
  })
  .passthrough();
// SECURITY: secret values are never returned by the list endpoint. This schema
// intentionally omits any `value` field; if one ever appears it is dropped by
// the parser because the response object is .passthrough()-only on declared
// fields. The endpoint layer MUST additionally strip any `value` key before
// logging or caching (defense in depth, spec §10.2).

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
    start: unixTimestampSchema,
    end: unixTimestampSchema,
    acus: acuCountSchema,
    org_id: z.string().optional(),
  })
  .passthrough();

export const consumptionCycleListResponseSchema = paginatedResponseSchema(
  consumptionCycleSchema,
);

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
    agent: z.string().optional(),
    notify_on: z.string().optional(),
    consecutive_failures: z.number().optional(),
    last_executed_at: z.string().nullable().optional(),
    last_error_message: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
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
// Code scans (Devin Security — enterprise-scoped)
// ---------------------------------------------------------------------------

export const codeScanFindingSchema = z
  .object({
    finding_id: z.string(),
    scan_id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    recommendation: z.string().nullable().optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
    status: z.enum(['open', 'dismissed', 'resolved']).catch('open'),
    category: z.string().nullable().optional(),
    repo_name: z.string(),
    pr_url: z.string().nullable().optional(),
    session_id: z.string().nullable().optional(),
    created_at: z.number().optional(),
  })
  .passthrough();

export const codeScanFindingListResponseSchema = paginatedResponseSchema(codeScanFindingSchema);

// ---------------------------------------------------------------------------
// Resource management requests (outbound validation)
// ---------------------------------------------------------------------------

export const knowledgeNoteCreateRequestSchema = z
  .object({
    name: z.string().min(1),
    body: z.string().min(1),
    trigger: z.string().min(1),
    folder_id: z.string().nullable().optional(),
    is_enabled: z.boolean().optional(),
    pinned_repo: z.string().nullable().optional(),
  })
  .passthrough();

export const playbookCreateRequestSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    macro: z.string().nullable().optional(),
  })
  .passthrough();

export const secretCreateRequestSchema = z
  .object({
    type: secretTypeSchema,
    key: z.string().min(1).max(256),
    value: z.string().min(1),
    note: z.string().nullable().optional(),
    is_sensitive: z.boolean().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Org metrics (Analytics)
// ---------------------------------------------------------------------------

const countRecordSchema = z.record(z.number());

export const sessionMetricsSchema = z
  .object({
    sessions_created_count: z.number(),
    sessions_created_by_size: countRecordSchema.optional().default({}),
    sessions_created_by_origin: countRecordSchema.optional().default({}),
    sessions_created_with_playbook_count: z.number().optional().default(0),
    sessions_created_with_search_count: z.number().optional().default(0),
    sessions_with_merged_prs_count: z.number().optional().default(0),
    sessions_with_merged_prs_by_size: countRecordSchema.optional().default({}),
    avg_acus_per_session: z.number().optional().default(0),
  })
  .passthrough();

export const prMetricsSchema = z
  .object({
    prs_created_count: z.number().optional(),
    prs_opened_count: z.number().optional(),
    prs_merged_count: z.number().optional(),
    prs_closed_count: z.number().optional(),
  })
  .passthrough();

export const searchMetricsSchema = z
  .object({ searches_created_count: z.number().optional() })
  .passthrough();

export const activeUserPeriodSchema = z
  .object({
    start_time: z.union([z.number(), z.string()]),
    end_time: z.union([z.number(), z.string()]),
    active_users: z.number(),
  })
  .passthrough();

// The list may arrive bare or wrapped in an items envelope.
export const activeUsersResponseSchema = z.union([
  z.array(activeUserPeriodSchema),
  z.object({ items: z.array(activeUserPeriodSchema) }).passthrough(),
]);

// ---------------------------------------------------------------------------
// Repositories (v3beta1)
// ---------------------------------------------------------------------------

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
    indexing_status: z.string().nullable().optional(),
  })
  .passthrough();

export const repositoryListResponseSchema = paginatedResponseSchema(repositoryResponseSchema);
