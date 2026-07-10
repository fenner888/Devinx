import { useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { useConnections } from '@auth/ConnectionContext';
import {
  ComputerBridgeError,
  loadComputerSession,
  openComputerBridges,
  type ComputerLoadedSession,
  type ComputerBridgeConnection,
  type ComputerSessionSummary,
} from '@auth/computerBridge';
import type { PairedComputerSummary } from '@auth/pairedComputers';
import { connectionModeUsesComputer } from '@lib/connections';

const MAXIMUM_PAGES_PER_COMPUTER = 5;
const MAXIMUM_SESSIONS_PER_COMPUTER = 5_000;

export interface ComputerSessionListItem extends ComputerSessionSummary {
  bridgeId: string;
  computerName: string;
  canLoad: boolean;
}

export type ComputerDiscoveryState =
  'ready' | 'session_discovery_off' | 'authorization_failed' | 'unavailable' | 'invalid_response';

export interface ComputerDiscoveryStatus {
  bridgeId: string;
  computerName: string;
  state: ComputerDiscoveryState;
}

export interface ComputerSessionBoard {
  sessions: ComputerSessionListItem[];
  computers: ComputerDiscoveryStatus[];
}

function stateForError(error: unknown): ComputerDiscoveryState {
  if (!(error instanceof ComputerBridgeError)) return 'unavailable';
  if (
    error.code === 'not_paired' ||
    error.code === 'permission_denied' ||
    error.code === 'authorization_failed'
  ) {
    return 'authorization_failed';
  }
  if (error.code === 'invalid_response') return 'invalid_response';
  return 'unavailable';
}

async function discoverComputer(
  computer: PairedComputerSummary,
  bridge: ComputerBridgeConnection,
): Promise<{ sessions: ComputerSessionListItem[]; status: ComputerDiscoveryStatus }> {
  try {
    const health = await bridge.getHealth();
    if (!health.capabilities.sessionList) {
      return {
        sessions: [],
        status: {
          bridgeId: computer.bridgeId,
          computerName: computer.computerName,
          state: 'session_discovery_off',
        },
      };
    }

    const sessions: ComputerSessionListItem[] = [];
    const sessionIds = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let pageNumber = 0; pageNumber < MAXIMUM_PAGES_PER_COMPUTER; pageNumber += 1) {
      const page = await bridge.listSessions(cursor ? { cursor } : {});
      for (const session of page.sessions) {
        if (sessionIds.has(session.id) || sessions.length >= MAXIMUM_SESSIONS_PER_COMPUTER) {
          throw new ComputerBridgeError(
            'The paired Mac returned an invalid session sequence.',
            'invalid_response',
          );
        }
        sessionIds.add(session.id);
        sessions.push({
          ...session,
          bridgeId: computer.bridgeId,
          computerName: computer.computerName,
          canLoad:
            health.capabilities.sessionLoad &&
            computer.permissions.includes('session:content:read'),
        });
      }
      if (!page.nextCursor) break;
      if (pageNumber === MAXIMUM_PAGES_PER_COMPUTER - 1) {
        throw new ComputerBridgeError(
          'The paired Mac exceeded the bounded session page limit.',
          'invalid_response',
        );
      }
      if (cursors.has(page.nextCursor)) {
        throw new ComputerBridgeError(
          'The paired Mac repeated a session cursor.',
          'invalid_response',
        );
      }
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    return {
      sessions,
      status: {
        bridgeId: computer.bridgeId,
        computerName: computer.computerName,
        state: 'ready',
      },
    };
  } catch (error) {
    return {
      sessions: [],
      status: {
        bridgeId: computer.bridgeId,
        computerName: computer.computerName,
        state: stateForError(error),
      },
    };
  }
}

function updatedAtMilliseconds(session: ComputerSessionListItem): number {
  if (!session.updatedAt) return 0;
  const parsed = Date.parse(session.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadComputerSessionBoard(
  computers: PairedComputerSummary[],
): Promise<ComputerSessionBoard> {
  if (computers.length === 0) return { sessions: [], computers: [] };
  let bridges: Map<string, ComputerBridgeConnection>;
  try {
    bridges = await openComputerBridges(computers.map((computer) => computer.bridgeId));
  } catch (error) {
    return {
      sessions: [],
      computers: computers.map((computer) => ({
        bridgeId: computer.bridgeId,
        computerName: computer.computerName,
        state: stateForError(error),
      })),
    };
  }
  const results = await Promise.all(
    computers.map((computer) => {
      const bridge = bridges.get(computer.bridgeId);
      if (!bridge) {
        return {
          sessions: [],
          status: {
            bridgeId: computer.bridgeId,
            computerName: computer.computerName,
            state: 'authorization_failed' as const,
          },
        };
      }
      return discoverComputer(computer, bridge);
    }),
  );
  return {
    sessions: results
      .flatMap((result) => result.sessions)
      .sort((left, right) => updatedAtMilliseconds(right) - updatedAtMilliseconds(left)),
    computers: results.map((result) => result.status),
  };
}

export function useComputerSessions() {
  const { mode, computers } = useConnections();
  const enabled = connectionModeUsesComputer(mode) && computers.length > 0;
  const bridgeIds = computers.map((computer) => computer.bridgeId).sort();

  return useQuery({
    queryKey: ['computerSessions', ...bridgeIds],
    queryFn: () => loadComputerSessionBoard(computers),
    enabled,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: () => (AppState.currentState === 'active' ? 30_000 : false),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
}

export function useComputerSessionDetail(
  bridgeId: string,
  sessionId: string,
  enabled = true,
) {
  return useQuery<ComputerLoadedSession, Error>({
    queryKey: ['computerSession', bridgeId, sessionId],
    queryFn: () => loadComputerSession(bridgeId, sessionId),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
}
