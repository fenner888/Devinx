import type { SessionResponse } from '@api/devin/types';

export interface SecurityWorkGroup {
  root: SessionResponse;
  workers: SessionResponse[];
  updatedAt: number;
}

/**
 * Devin's platform-generated Code Scan coordinators arrive as top-level
 * `code_scan` sessions. The server-provided origin is the canonical boundary;
 * titles, prompts, categories, and client tags are never substitutes.
 */
export function isVerifiedCodeScanRoot(session: SessionResponse): boolean {
  return session.origin === 'code_scan' && session.parent_session_id === null;
}

export function isSecurityWorkSession(session: SessionResponse): boolean {
  return isVerifiedCodeScanRoot(session);
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
