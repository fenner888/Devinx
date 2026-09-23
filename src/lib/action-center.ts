import type { ComputerDiscoveryStatus } from '@api/bridge/queries';
import type { SessionResponse } from '@api/devin/types';
import { deriveStatusKey } from '@lib/session-utils';

export type ActionCenterKind = 'input' | 'approval' | 'problem' | 'completed' | 'localDevice';

export interface ActionCenterItem {
  id: string;
  kind: ActionCenterKind;
  title: string;
  detail: string;
  priority: number;
  route: string;
  updatedAt: number;
}

function cloudItem(session: SessionResponse, watched: Set<string>): ActionCenterItem | null {
  const title = session.title?.trim() || 'Untitled session';
  const version = session.updated_at;
  const base = {
    route: `/(main)/session/${session.session_id}`,
    updatedAt: session.updated_at,
  };
  const statusKey = deriveStatusKey(session);
  if (statusKey === 'waitingForResponse') {
    return {
      ...base,
      id: `cloud:${session.session_id}:input:${version}`,
      kind: 'input',
      title,
      detail: 'Devin is waiting for your response.',
      priority: 0,
    };
  }
  if (statusKey === 'approvalRequired') {
    return {
      ...base,
      id: `cloud:${session.session_id}:approval:${version}`,
      kind: 'approval',
      title,
      detail: 'A session action needs your approval.',
      priority: 1,
    };
  }
  if (statusKey === 'crashed' || statusKey === 'exceededLimit') {
    return {
      ...base,
      id: `cloud:${session.session_id}:problem:${version}`,
      kind: 'problem',
      title,
      detail:
        statusKey === 'exceededLimit'
          ? 'This session stopped because of an account or usage limit.'
          : 'This session needs attention after an error.',
      priority: 2,
    };
  }
  if (watched.has(session.session_id) && (statusKey === 'done' || statusKey === 'prReady')) {
    return {
      ...base,
      id: `cloud:${session.session_id}:completed:${version}`,
      kind: 'completed',
      title,
      detail: 'A watched session finished.',
      priority: 3,
    };
  }
  return null;
}

export function deriveActionCenterItems(input: {
  cloudSessions?: SessionResponse[];
  computerStatuses?: ComputerDiscoveryStatus[];
  watchedSessionIds?: string[];
  acknowledgedActionIds?: string[];
}): ActionCenterItem[] {
  const watched = new Set(input.watchedSessionIds ?? []);
  const acknowledged = new Set(input.acknowledgedActionIds ?? []);
  const items = (input.cloudSessions ?? [])
    .map((session) => cloudItem(session, watched))
    .filter((item): item is ActionCenterItem => item !== null);

  for (const computer of input.computerStatuses ?? []) {
    if (computer.state === 'ready') continue;
    items.push({
      id: `computer:${computer.bridgeId}:${computer.state}`,
      kind: 'localDevice',
      title: computer.computerName,
      detail:
        computer.state === 'session_discovery_off'
          ? 'This Connector does not advertise session discovery.'
          : computer.state === 'authorization_failed'
            ? 'This local-device connection must be paired or authorized again.'
            : computer.state === 'invalid_response'
              ? 'The Connector returned an invalid signed response.'
              : 'The Connector is currently unreachable.',
      priority: 4,
      route: `/(main)/computer-profile/${computer.bridgeId}`,
      updatedAt: 0,
    });
  }

  return items
    // Reachability failures represent current signed Connector health. They
    // remain visible until the device recovers rather than being permanently
    // hidden by a device-local acknowledgement from an earlier outage.
    .filter((item) => item.kind === 'localDevice' || !acknowledged.has(item.id))
    .sort((left, right) => left.priority - right.priority || right.updatedAt - left.updatedAt);
}
