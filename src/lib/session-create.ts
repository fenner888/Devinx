import type { SessionCreateRequest, SessionResponse } from '@api/devin/types';

export function findPotentialCreatedSession(
  body: SessionCreateRequest,
  sessions: SessionResponse[],
  startedAt: number,
  identity?: { service_user_id?: string; user_id?: string },
): SessionResponse | undefined {
  if (!identity?.service_user_id && !identity?.user_id) return undefined;
  const candidates = sessions.filter(
    (session) =>
      session.origin === 'api' &&
      session.created_at >= startedAt - 5 &&
      (!body.title || session.title === body.title) &&
      (!identity.service_user_id || session.service_user_id === identity.service_user_id) &&
      (!identity.user_id || session.user_id === identity.user_id),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
