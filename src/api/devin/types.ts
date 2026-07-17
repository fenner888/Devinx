/**
 * Devin API v3 TypeScript types — generated from live docs.devin.ai reference
 * (OpenAPI contract refreshed 2026-07-17). See /specs/api-deltas.md for divergences from the
 * build spec's §2.3/§8.5 assumptions.
 *
 * Base URL: https://api.devin.ai
 * Org-scoped paths: /v3/organizations/{org_id}/...
 * Enterprise paths: /v3/enterprise/...
 * Auth: `Authorization: Bearer cog_*` (service-user keys; PATs remain closed beta).
 */

// ---------------------------------------------------------------------------
// Primitives & enums
// ---------------------------------------------------------------------------

/** Service-user API key prefix. PATs not yet GA. */
export type ApiKey = string;

/** Server-issued organization ID (`org-` or legacy `org_`). */
export type OrgId = string;

/** Session ID with `devin-` prefix. */
export type DevinId = string;

/** Cursor for pagination (opaque string). */
export type Cursor = string;

/** Unix timestamp (seconds). */
export type UnixTimestamp = number;

/** ACU (Agent Compute Unit) consumption figure. */
export type AcuCount = number;

export type SessionStatus =
  'new' | 'claimed' | 'running' | 'exit' | 'error' | 'suspended' | 'resuming';

export type SessionStatusDetail =
  | 'working'
  | 'waiting_for_user'
  | 'waiting_for_approval'
  | 'finished'
  | 'inactivity'
  | 'user_request'
  | 'usage_limit_exceeded'
  | 'out_of_credits'
  | 'out_of_quota'
  | 'no_quota_allocation'
  | 'payment_declined'
  | 'org_usage_limit_exceeded'
  | 'total_session_limit_exceeded'
  | 'error'
  // May carry values beyond this list — treat as an open string set.
  | (string & {});

export type SessionOrigin =
  | 'webapp'
  | 'slack'
  | 'teams'
  | 'api'
  | 'linear'
  | 'jira'
  | 'automation'
  | 'cli'
  | 'desktop'
  | 'code_scan'
  | 'other';

export type SessionCategory =
  | 'bug_fixing'
  | 'ci_cd_and_devops'
  | 'code_quality_and_security'
  | 'code_review'
  | 'code_review_and_analysis'
  | 'data_and_automation'
  | 'documentation_and_content'
  | 'feature_development'
  | 'migrations_and_upgrades'
  | 'other'
  | 'refactoring_and_optimization'
  | 'research_and_exploration'
  | 'security'
  | 'unit_test_generation';

/** Modes accepted by the documented v3 create-session contract. */
export type DevinMode = 'normal' | 'fast' | 'lite' | 'ultra' | 'fusion';

export type SessionSize = 'xs' | 's' | 'm' | 'l' | 'xl';

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecretType = 'cookie' | 'key-value' | 'totp';

export type AccessType = 'enterprise' | 'org' | 'personal';

export type PrState = 'open' | 'merged' | 'closed' | 'draft';

export type MessageSource = 'devin' | 'user';

// ---------------------------------------------------------------------------
// Pagination envelope
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  end_cursor: Cursor | null;
  has_next_page: boolean;
  items: T[];
  total?: number | null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface PullRequest {
  pr_state: string | null;
  pr_url: string;
  /** Present in some v3 responses (draft flag). */
  draft?: boolean;
  /** Internal state string: open | merged | closed. */
  state?: PrState;
  merged_at?: UnixTimestamp | null;
  closed?: number;
}

export interface SessionSecretInput {
  key: string;
  value: string;
  sensitive?: boolean;
}

export interface SessionCreateRequest {
  prompt: string;
  attachment_urls?: string[] | null;
  bypass_approval?: boolean | null;
  child_playbook_id?: string | null;
  create_as_user_id?: string | null;
  devin_mode?: DevinMode | null;
  knowledge_ids?: string[] | null;
  max_acu_limit?: number | null;
  /** Must match an organization-configured platform label. */
  platform?: string | null;
  playbook_id?: string | null;
  /** Repos the session should work in (host-prefixed paths). */
  repos?: string[] | null;
  /** Preserve VM state after the session stops. Defaults to true server-side. */
  resumable?: boolean;
  secret_ids?: string[] | null;
  session_links?: string[] | null;
  session_secrets?: SessionSecretInput[] | null;
  structured_output_required?: boolean | null;
  structured_output_schema?: Record<string, unknown> | null;
  tags?: string[] | null;
  title?: string | null;
}

export interface SessionResponse {
  acus_consumed: AcuCount;
  category: SessionCategory | null;
  child_session_ids: string[] | null;
  created_at: UnixTimestamp;
  is_archived: boolean;
  org_id: string;
  origin: SessionOrigin | null;
  parent_session_id: string | null;
  playbook_id: string | null;
  pull_requests: PullRequest[];
  service_user_id: string | null;
  user_id?: string | null;
  session_id: string;
  status: SessionStatus;
  status_detail?: SessionStatusDetail | null;
  structured_output?: Record<string, unknown> | null;
  tags: string[];
  title: string | null;
  updated_at: UnixTimestamp;
  url: string;
  /** v3 also exposes subcategory in some responses. */
  subcategory?: string | null;
  /** Web-app-only fields surfaced via the session detail endpoint. */
  latest_status_contents?: {
    enum?: 'working' | 'blocked' | 'finished' | string;
    reason?: string;
    user_action_required?: string;
  } | null;
  latest_status_event_at?: UnixTimestamp | null;
  latest_permission_contents?: {
    type?: 'permission_request';
    tool_name?: string;
    permission_type?: string;
  } | null;
  latest_permission_event_at?: UnixTimestamp | null;
  latest_loop_contents?: { type?: 'pause' } | null;
  latest_loop_event_at?: UnixTimestamp | null;
  latest_approval_contents?: { type?: 'actions_request' } | null;
  latest_approval_event_at?: UnixTimestamp | null;
  current_activity_changed_at?: UnixTimestamp | null;
  activity_status_changed_at?: UnixTimestamp | null;
  is_unread?: boolean;
}

export interface SessionsQueryParams {
  after?: Cursor | null;
  category?: SessionCategory | null;
  created_after?: UnixTimestamp | null;
  created_before?: UnixTimestamp | null;
  first?: number; // default 100, max 200
  is_archived?: boolean | null;
  origins?: SessionOrigin[] | null;
  playbook_id?: string | null;
  repo_names?: string[] | null;
  schedule_id?: string | null;
  service_user_ids?: string[] | null;
  session_ids?: string[] | null;
  tags?: string[] | null;
  updated_after?: UnixTimestamp | null;
  updated_before?: UnixTimestamp | null;
  user_ids?: string[] | null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface SessionMessage {
  created_at: UnixTimestamp;
  event_id: string;
  message: string;
  source: MessageSource;
}

export interface SessionMessageCreateRequest {
  message: string;
  attachment_urls?: string[] | null;
  message_as_user_id?: string | null;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface SessionTagsUpdateRequest {
  tags: string[]; // maxItems 50
}

export interface SessionTagsResponse {
  tags: string[];
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface InsightsGenerateResponse {
  status: 'already_exists' | 'started';
}

export interface InsightActionItem {
  action_item: string;
  issue_id: string | null;
  type: string;
}

export interface InsightClassification {
  category: string;
  confidence: number;
  programming_languages: string[];
  tools_and_frameworks: string[];
}

export interface InsightIssue {
  id: string;
  impact: string;
  issue: string;
  label: string;
}

export interface InsightSuggestedPrompt {
  feedback_items: unknown[];
  original_prompt: string;
  suggested_prompt: string;
}

export interface InsightTimelineEntry {
  color: string;
  description: string;
  issue_id: string | null;
  title: string;
}

export interface SessionInsightsAnalysis {
  action_items: InsightActionItem[];
  classification: InsightClassification | null;
  issues: InsightIssue[];
  note_usage: unknown | null;
  suggested_prompt: InsightSuggestedPrompt | null;
  timeline: InsightTimelineEntry[];
}

export interface SessionInsightsResponse {
  session_id: string;
  org_id: string;
  url: string;
  num_devin_messages: number;
  num_user_messages: number;
  session_size?: string | null;
  status?: string;
  acus_consumed: AcuCount;
  created_at?: UnixTimestamp;
  updated_at?: UnixTimestamp;
  tags: string[];
  pull_requests: PullRequest[];
  /** Absent until insights have been generated for the session. */
  analysis?: SessionInsightsAnalysis | null;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export interface PlaybookResponse {
  playbook_id: string;
  title: string;
  body: string;
  macro: string | null;
  access_type: 'enterprise' | 'org';
  created_at: UnixTimestamp;
  created_by: string;
  org_id: string | null;
  structured_output_schema?: Record<string, unknown> | null;
  updated_at: UnixTimestamp;
  updated_by: string;
}

export interface KnowledgeNoteResponse {
  note_id: string;
  name: string;
  body: string;
  trigger: string;
  access_type: 'enterprise' | 'org';
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  folder_id: string | null;
  folder_path: string;
  is_enabled: boolean;
  macro: string | null;
  org_id: string | null;
  pinned_repo: string | null;
}

export interface SecretResponse {
  secret_id: string;
  key: string | null;
  note: string | null;
  secret_type: SecretType;
  access_type: 'org' | 'personal';
  created_at: UnixTimestamp;
  created_by: string;
  is_sensitive: boolean;
  updated_at?: UnixTimestamp | null;
  updated_by?: string | null;
  /** VALUES ARE NEVER RETURNED — only metadata. */
}

export interface User {
  user_id: string;
  email: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface AttachmentResponse {
  attachment_id: string;
  name: string;
  url: string;
}

export interface SessionAttachment extends AttachmentResponse {
  source: 'devin' | 'user';
  content_type?: string | null;
}

// ---------------------------------------------------------------------------
// Consumption
// ---------------------------------------------------------------------------

export interface DailyConsumptionResponse {
  /** Total ACUs for the day; may be omitted (sum acus_by_product instead). */
  acus?: AcuCount;
  /** Per-product ACUs — keys vary as Cognition ships products. */
  acus_by_product: Record<string, AcuCount>;
  date: string; // YYYY-MM-DD or ISO datetime
}

export interface ConsumptionCycle {
  /** Inclusive billing-cycle start timestamp. */
  after: UnixTimestamp;
  /** Exclusive billing-cycle end timestamp. */
  before: UnixTimestamp;
}

export interface DevinAcuLimit {
  cycle_acu_limit: AcuCount;
  scope: 'enterprise' | 'org' | 'user';
  /** Present for organization-level limits. */
  org_id?: string | null;
  /** Present for user-level limits if Devin adds them to this response. */
  user_id?: string | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface ApiErrorDetail {
  loc: string[];
  msg: string;
  type: string;
}

export interface ApiErrorResponse {
  detail: ApiErrorDetail[] | string;
}

// ---------------------------------------------------------------------------
// Endpoint path builders (kept here so types + paths travel together)
// ---------------------------------------------------------------------------

export const paths = {
  sessions: (orgId: OrgId) => `/v3/organizations/${orgId}/sessions`,
  session: (orgId: OrgId, devinId: DevinId) => `/v3/organizations/${orgId}/sessions/${devinId}`,
  messages: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/sessions/${devinId}/messages`,
  sessionAttachments: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/sessions/${devinId}/attachments`,
  archive: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/sessions/${devinId}/archive`,
  tags: (orgId: OrgId, devinId: DevinId) => `/v3/organizations/${orgId}/sessions/${devinId}/tags`,
  insightsGenerate: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/sessions/${devinId}/insights/generate`,
  insights: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/sessions/${devinId}/insights`,
  playbooks: (orgId: OrgId) => `/v3/organizations/${orgId}/playbooks`,
  knowledge: (orgId: OrgId) => `/v3/organizations/${orgId}/knowledge/notes`,
  knowledgeFolders: (orgId: OrgId) => `/v3/organizations/${orgId}/knowledge/folders`,
  secrets: (orgId: OrgId) => `/v3/organizations/${orgId}/secrets`,
  /** Enterprise-level (requires ViewAccountMembership). */
  membersEnterprise: (orgId: OrgId) => `/v3/enterprise/organizations/${orgId}/members/users`,
  /** Beta org-level (requires ViewOrgMembership). */
  membersOrgBeta: (orgId: OrgId) => `/v3beta1/organizations/${orgId}/members/users`,
  attachments: (orgId: OrgId) => `/v3/organizations/${orgId}/attachments`,
  attachment: (orgId: OrgId, uuid: string, name: string) =>
    `/v3/organizations/${orgId}/attachments/${uuid}/${name}`,
  consumptionDaily: (orgId: OrgId) => `/v3/organizations/${orgId}/consumption/daily`,
  /** Enterprise-level (requires ManageBilling). */
  consumptionCycles: () => `/v3/enterprise/consumption/cycles`,
  /** Read-only enterprise Devin ACU limits (requires ManageBilling). */
  devinAcuLimits: () => `/v3/enterprise/consumption/acu-limits/devin`,
  playbook: (orgId: OrgId, playbookId: string) =>
    `/v3/organizations/${orgId}/playbooks/${playbookId}`,
  knowledgeNote: (orgId: OrgId, noteId: string) =>
    `/v3/organizations/${orgId}/knowledge/notes/${noteId}`,
  secret: (orgId: OrgId, secretId: string) => `/v3/organizations/${orgId}/secrets/${secretId}`,
  metricsSessions: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/sessions`,
  metricsPrs: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/prs`,
  metricsSearches: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/searches`,
  metricsActiveUsers: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/active-users`,
  metricsDau: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/dau`,
  metricsMau: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/mau`,
  metricsWau: (orgId: OrgId) => `/v3/organizations/${orgId}/metrics/wau`,
  repositories: (orgId: OrgId) => `/v3beta1/organizations/${orgId}/repositories`,
  self: () => `/v3/self`,
  sessionConsumption: (orgId: OrgId, devinId: DevinId) =>
    `/v3/organizations/${orgId}/consumption/daily/sessions/${devinId}`,
  schedules: (orgId: OrgId) => `/v3/organizations/${orgId}/schedules`,
  schedule: (orgId: OrgId, scheduleId: string) =>
    `/v3/organizations/${orgId}/schedules/${scheduleId}`,
  prReviews: (orgId: OrgId) => `/v3/organizations/${orgId}/pr-reviews`,
} as const;

// ---------------------------------------------------------------------------
// Schedules (Automations)
// ---------------------------------------------------------------------------

export type ScheduleType = 'recurring' | 'one_time';
export type ScheduleNotifyOn = 'always' | 'failure' | 'never';
export type ScheduleAgent = 'devin' | 'data_analyst';

export interface ScheduleResponse {
  /** Schedule ID (prefix: sched-). */
  schedule_id: string;
  name: string;
  prompt: string;
  enabled: boolean;
  schedule_type: ScheduleType;
  /** Cron expression (recurring schedules). */
  frequency: string | null;
  /** ISO 8601 datetime (one-time schedules). */
  scheduled_at: string | null;
  agent: ScheduleAgent;
  bypass_approval?: boolean;
  interval_count?: number;
  notify_on: ScheduleNotifyOn;
  platform?: string | null;
  playbook: { playbook_id: string; title: string | null } | null;
  slack_channel_id?: string | null;
  slack_team_id?: string | null;
  target_devin_id?: string | null;
  consecutive_failures: number;
  created_by: string | null;
  last_edited_by?: string | null;
  last_error_at: string | null;
  last_executed_at: string | null;
  last_error_message: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[] | null;
}

export interface ScheduleCreateRequest {
  name: string;
  prompt: string;
  schedule_type?: ScheduleType;
  frequency?: string | null;
  scheduled_at?: string | null;
  tags?: string[] | null;
  playbook_id?: string | null;
  notify_on?: ScheduleNotifyOn;
  /** Which agent runs the schedule (the API supports both). */
  agent?: ScheduleAgent;
  /** Advanced API fields are modeled for exact request validation but remain
   * hidden until mobile has a safe discovery and permission flow. */
  bypass_approval?: boolean;
  create_as_user_id?: string | null;
  interval_count?: number;
  platform?: string | null;
  slack_channel_id?: string | null;
  slack_team_id?: string | null;
  target_devin_id?: string | null;
}

export interface ScheduleUpdateRequest {
  name?: string | null;
  prompt?: string | null;
  enabled?: boolean | null;
  frequency?: string | null;
  scheduled_at?: string | null;
  schedule_type?: ScheduleType | null;
  tags?: string[] | null;
  playbook_id?: string | null;
  notify_on?: ScheduleNotifyOn | null;
  agent?: ScheduleAgent | null;
  bypass_approval?: boolean | null;
  interval_count?: number | null;
  platform?: string | null;
  run_as_user_id?: string | null;
  slack_channel_id?: string | null;
  slack_team_id?: string | null;
  target_devin_id?: string | null;
}

// ---------------------------------------------------------------------------
// PR Reviews (Devin Review)
// ---------------------------------------------------------------------------

export type PrReviewStatus = 'pending' | 'running' | 'completed' | 'errored' | 'cancelled';

export interface PrReviewResponse {
  status: PrReviewStatus;
  /** Host-prefixed repo path, e.g. github.com/owner/repo. */
  repo_path: string;
  pr_number: number;
  commit_sha: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Resource management (Knowledge / Playbooks / Secrets)
// ---------------------------------------------------------------------------

export interface KnowledgeNoteCreateRequest {
  name: string;
  body: string;
  trigger: string;
  folder_id?: string | null;
  is_enabled?: boolean | null;
  pinned_repo?: string | null;
}

export interface KnowledgeFolderSummary {
  folder_id: string;
  name: string;
  note_count: number;
  parent_folder_id: string | null;
  path: string;
}

export interface KnowledgeFolderTree {
  folders: KnowledgeFolderSummary[];
  root_note_count: number;
}

export type KnowledgeNoteUpdateRequest = Partial<KnowledgeNoteCreateRequest>;

export interface PlaybookCreateRequest {
  title: string;
  body: string;
  macro?: string | null;
  structured_output_schema?: Record<string, unknown> | null;
}

export type PlaybookUpdateRequest = Partial<PlaybookCreateRequest>;

export interface SecretCreateRequest {
  type: SecretType;
  key: string;
  value: string;
  note?: string | null;
  is_sensitive?: boolean;
}

// ---------------------------------------------------------------------------
// Org metrics (Analytics)
// ---------------------------------------------------------------------------

export interface SessionMetrics {
  sessions_created_count: number;
  sessions_created_by_size: Record<string, number>;
  sessions_created_by_origin: Record<string, number>;
  sessions_created_with_playbook_count: number;
  sessions_created_with_search_count: number;
  sessions_with_merged_prs_count: number;
  sessions_with_merged_prs_by_size: Record<string, number>;
  avg_acus_per_session: number;
}

export interface PrMetrics {
  prs_created_count?: number;
  prs_opened_count?: number;
  prs_merged_count?: number;
  prs_closed_count?: number;
}

export interface SearchMetrics {
  searches_created_count?: number;
}

export interface ActiveUserPeriod {
  start_time: number;
  end_time: number;
  active_users: number;
}

export interface MetricsQuery {
  time_after?: number;
  time_before?: number;
}

// ---------------------------------------------------------------------------
// Repositories (v3beta1)
// ---------------------------------------------------------------------------

export interface RepositoryResponse {
  provider_repository_id: string;
  git_connection_id: string;
  git_connection_host: string;
  repo_name: string;
  repo_path: string;
  repo_description: string | null;
  repo_language: string | null;
  last_updated_at: string | number | null;
  indexing_status?: RepositoryIndexingStatus | null;
}

export interface RepositoryIndexJob {
  branch_name: string;
  commit: string;
  created_at: number | string;
  job_id: string;
}

export interface RepositoryIndexingStatus {
  indexing_enabled: boolean;
  latest_completed_search_index_job?: RepositoryIndexJob | null;
  latest_completed_wiki_index_job?: RepositoryIndexJob | null;
  latest_indexes?: RepositoryIndexJob[];
}

// ---------------------------------------------------------------------------
// Self / identity
// ---------------------------------------------------------------------------

export interface SelfResponse {
  principal_type?: string;
  org_id?: string;
  /** Service-user identity. */
  service_user_id?: string;
  service_user_name?: string;
  /** PAT identity. */
  user_id?: string;
  api_key_id?: string;
  api_key_name?: string;
}
