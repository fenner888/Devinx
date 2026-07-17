/**
 * Session utilities — shared between Board and Session Detail.
 * Status derivation, sorting, sectioning, formatting.
 */

import type { SessionResponse, DevinMode } from '@api/devin/types';
import { statusLabels, type StatusLabelKey } from '@theme/tokens';

/** status_detail values that mean the session hit a billing/usage limit. */
const LIMIT_DETAILS = new Set([
  'usage_limit_exceeded',
  'out_of_credits',
  'out_of_quota',
  'no_quota_allocation',
  'payment_declined',
  'org_usage_limit_exceeded',
  'total_session_limit_exceeded',
]);

/** Derive the status label key from a session (mirrors web app state machine). */
export function deriveStatusKey(s: SessionResponse): StatusLabelKey {
  if (s.status === 'error') return 'crashed';
  if (s.status === 'exit') {
    if (s.status_detail === 'finished') {
      if (s.pull_requests.length > 0) {
        const pr = s.pull_requests[0];
        if (pr?.state === 'merged' || pr?.merged_at) return 'done';
        return 'prReady';
      }
      return 'done';
    }
    return 'closed';
  }
  if (s.status === 'suspended') {
    // Any billing/quota-limit detail reads as "Exceeded limit", not "Sleeping".
    if (LIMIT_DETAILS.has(s.status_detail ?? '')) return 'exceededLimit';
    return 'sleeping';
  }
  if (s.status_detail === 'waiting_for_user') return 'waitingForResponse';
  if (s.status_detail === 'waiting_for_approval') return 'approvalRequired';
  if (s.status_detail === 'finished') return 'done';
  return 'working';
}

export function removeSessionFromBoard(
  sessions: SessionResponse[] | undefined,
  sessionId: string,
): SessionResponse[] | undefined {
  if (!sessions) return sessions;
  const normalizedId = sessionId.replace(/^devin-/, '');
  return sessions.filter((session) => session.session_id.replace(/^devin-/, '') !== normalizedId);
}

/** Section keys for the board. */
export type SectionKey = 'needs_input' | 'working' | 'recent' | 'sleeping';

export const sectionTitles: Record<SectionKey, string> = {
  needs_input: 'Needs input',
  working: 'Working',
  recent: 'Recent',
  sleeping: 'Sleeping',
};

/** Map a status key to a board section. */
export function statusKeyToSection(key: StatusLabelKey): SectionKey {
  if (key === 'waitingForResponse' || key === 'approvalRequired' || key === 'exceededLimit')
    return 'needs_input';
  if (
    key === 'working' ||
    key === 'settingUp' ||
    key === 'planning' ||
    key === 'coding' ||
    key === 'iterating' ||
    key === 'testing'
  )
    return 'working';
  if (
    key === 'prReady' ||
    key === 'prReadyWaitingCI' ||
    key === 'waitingForCI' ||
    key === 'reviewPR' ||
    key === 'done' ||
    key === 'closed' ||
    key === 'crashed'
  )
    return 'recent';
  return 'sleeping';
}

/** Sort priority for blocked-first ordering (parity-delta #1). */
function sortPriority(s: SessionResponse): number {
  const key = deriveStatusKey(s);
  const section = statusKeyToSection(key);
  if (section === 'needs_input') return 0;
  if (section === 'working') return 1;
  if (section === 'recent') return 2;
  return 3;
}

/** Sort sessions: blocked-first, then by updated_at descending. */
export function sortSessions(sessions: SessionResponse[]): SessionResponse[] {
  return [...sessions].sort((a, b) => {
    const pa = sortPriority(a);
    const pb = sortPriority(b);
    if (pa !== pb) return pa - pb;
    return b.updated_at - a.updated_at;
  });
}

/** Group sessions into board sections (preserving sort order). */
export function sectionSessions(
  sessions: SessionResponse[],
  pinnedSessionIds: string[] = [],
): { section: SectionKey; data: SessionResponse[] }[] {
  const sorted = sortSessions(sessions);
  const groups: Record<SectionKey, SessionResponse[]> = {
    needs_input: [],
    working: [],
    recent: [],
    sleeping: [],
  };
  for (const s of sorted) {
    const key = deriveStatusKey(s);
    groups[statusKeyToSection(key)].push(s);
  }
  const pinned = new Set(pinnedSessionIds);
  return (Object.keys(groups) as SectionKey[])
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      section: key,
      data: groups[key].sort(
        (a, b) => Number(pinned.has(b.session_id)) - Number(pinned.has(a.session_id)),
      ),
    }));
}

/** Status color class for text/dot. */
export function statusColorClass(key: StatusLabelKey): string {
  if (key === 'crashed') return 'text-failed';
  if (key === 'waitingForResponse' || key === 'approvalRequired' || key === 'exceededLimit')
    return 'text-blocked';
  if (
    key === 'prReady' ||
    key === 'prReadyWaitingCI' ||
    key === 'waitingForCI' ||
    key === 'reviewPR' ||
    key === 'done'
  )
    return 'text-finished';
  if (key === 'sleeping' || key === 'closed') return 'text-text-mid';
  return 'text-brand';
}

/** Status dot bg class (derived from text class). */
export function statusDotClass(key: StatusLabelKey): string {
  return statusColorClass(key).replace('text-', 'bg-');
}

/** Get the human-readable label for a session. */
export function statusLabel(s: SessionResponse): string {
  return statusLabels[deriveStatusKey(s)];
}

/** Format a Unix timestamp as a relative time string (e.g. "2m ago", "3h ago"). */
export function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

/** Extract PR number from a PR URL. */
export function prNumber(prUrl: string): string {
  if (!prUrl) return 'PR';
  const parts = prUrl.split('/');
  const num = parts[parts.length - 1] ?? '';
  // Return only if it looks like a number, otherwise 'PR'.
  return /^\d+$/.test(num) ? num : 'PR';
}

/** Filter sessions by search query (title, tags, session_id). */
export function filterBySearch(sessions: SessionResponse[], query: string): SessionResponse[] {
  if (!query.trim()) return sessions;
  const q = query.toLowerCase().trim();
  return sessions.filter(
    (s) =>
      (s.title ?? '').toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.session_id.toLowerCase().includes(q),
  );
}

/** Filter sessions by a set of tags (AND logic — must have all selected tags). */
export function filterByTags(sessions: SessionResponse[], tags: string[]): SessionResponse[] {
  if (tags.length === 0) return sessions;
  return sessions.filter((s) => tags.every((t) => s.tags.includes(t)));
}

/** Collect all unique tags from sessions, sorted by frequency. */
export function collectTags(sessions: SessionResponse[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const t of s.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Execution modes accepted by the v3 create-session API (`devin_mode`).
 * Labels/descriptions shown in the composer mode pickers.
 */
export const MODE_OPTIONS: { key: DevinMode; label: string; description: string }[] = [
  { key: 'normal', label: 'Normal', description: 'Default Agent mode — full capability' },
  { key: 'fast', label: 'Fast', description: 'About 2× faster and 4× more expensive' },
  { key: 'lite', label: 'Lite', description: 'Devin Lite mode' },
  { key: 'ultra', label: 'Ultra', description: 'Devin Ultra preview mode' },
  { key: 'fusion', label: 'Fusion', description: 'Fusion preview mode' },
];

export function modeLabel(mode: DevinMode): string {
  return MODE_OPTIONS.find((m) => m.key === mode)?.label ?? 'Normal';
}
