/**
 * Query keys — centralized for invalidation (spec §8.1).
 */

export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  messages: (id: string) => ['messages', id] as const,
  messageFollowUp: (id: string) => ['messageFollowUp', id] as const,
  playbooks: ['playbooks'] as const,
  knowledge: ['knowledge'] as const,
  knowledgeFolders: ['knowledgeFolders'] as const,
  secrets: ['secrets'] as const,
  consumption: ['consumption'] as const,
  billingLimits: ['billingLimits'] as const,
  insights: (id: string) => ['insights', id] as const,
  tags: (id: string) => ['tags', id] as const,
  schedules: ['schedules'] as const,
  metrics: (range: string) => ['metrics', range] as const,
  repositories: ['repositories'] as const,
  self: ['self'] as const,
  sessionConsumption: (id: string) => ['sessionConsumption', id] as const,
  repoIndexing: ['repoIndexing'] as const,
  prReview: (url: string) => ['prReview', url] as const,
  codeScanFindings: ['codeScanFindings'] as const,
  codeScanMetrics: ['codeScanMetrics'] as const,
} as const;
