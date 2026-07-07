/**
 * Query keys — centralized for invalidation (spec §8.1).
 */

export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  messages: (id: string) => ['messages', id] as const,
  playbooks: ['playbooks'] as const,
  knowledge: ['knowledge'] as const,
  secrets: ['secrets'] as const,
  consumption: ['consumption'] as const,
  insights: (id: string) => ['insights', id] as const,
  tags: (id: string) => ['tags', id] as const,
} as const;
