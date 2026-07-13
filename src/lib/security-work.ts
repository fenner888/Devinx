import type { SessionResponse } from '@api/devin/types';

export const SECURITY_WORK_TAG = 'devinx-security-work';
export const SECURITY_REVIEW_TAG = 'security-review';

const SECURITY_CATEGORIES = new Set(['code_quality_and_security', 'security']);
const SECURITY_TAGS = new Set([
  SECURITY_WORK_TAG,
  SECURITY_REVIEW_TAG,
  'code-scan',
  'code_scan',
  'security',
]);

export interface SecurityWorkGroup {
  root: SessionResponse;
  workers: SessionResponse[];
  updatedAt: number;
}

export function isSecurityWorkSession(session: SessionResponse): boolean {
  return (
    (session.category !== null && SECURITY_CATEGORIES.has(session.category)) ||
    session.origin === 'code_scan' ||
    session.tags.some((tag) => SECURITY_TAGS.has(tag.trim().toLowerCase()))
  );
}

/**
 * Builds a bounded in-memory view of supported session relationships. A
 * security coordinator pulls in its returned child sessions even when those
 * workers have not received a category or tag of their own yet.
 */
export function groupSecurityWork(sessions: readonly SessionResponse[]): SecurityWorkGroup[] {
  const byId = new Map(sessions.map((session) => [session.session_id, session]));
  const included = new Set(
    sessions.filter(isSecurityWorkSession).map((session) => session.session_id),
  );
  const queue = [...included];

  while (queue.length > 0) {
    const session = byId.get(queue.shift()!);
    if (!session) continue;
    for (const childId of session.child_session_ids ?? []) {
      if (!byId.has(childId) || included.has(childId)) continue;
      included.add(childId);
      queue.push(childId);
    }
  }

  const groups = new Map<string, SecurityWorkGroup>();
  for (const id of included) {
    const session = byId.get(id);
    if (!session) continue;
    let root = session;
    const visited = new Set([root.session_id]);
    while (root.parent_session_id && included.has(root.parent_session_id)) {
      const parent = byId.get(root.parent_session_id);
      if (!parent || visited.has(parent.session_id)) break;
      root = parent;
      visited.add(root.session_id);
    }

    const group = groups.get(root.session_id) ?? {
      root,
      workers: [],
      updatedAt: root.updated_at,
    };
    if (session.session_id !== root.session_id) group.workers.push(session);
    group.updatedAt = Math.max(group.updatedAt, session.updated_at);
    groups.set(root.session_id, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      workers: group.workers.sort((left, right) => right.updated_at - left.updated_at),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function securityReviewPrompt(repositoryPath: string, focus?: string): string {
  const printableRepository = Array.from(repositoryPath, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? ' ' : character;
  }).join('');
  const boundedRepository = printableRepository
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
  const boundedFocus = focus?.trim().slice(0, 1_000);
  return [
    `Perform a read-only security review of the repository ${JSON.stringify(boundedRepository)}.`,
    'Coordinate parallel child sessions where useful so independent checks can run concurrently.',
    'Cover authentication and authorization, cross-tenant and IDOR risks, input validation, secrets and sensitive logging, dependency risk, data handling, and unsafe defaults.',
    'Do not modify code, rotate credentials, install dependencies, or open a pull request during this review.',
    'Return a prioritized report with evidence, affected files, severity, exploitability, and a proposed remediation plan. Clearly distinguish confirmed findings from hypotheses.',
    boundedFocus ? `Additional focus from the user: ${boundedFocus}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');
}
