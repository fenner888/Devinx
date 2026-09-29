import { useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { useConnections } from '@auth/ConnectionContext';
import {
  getComputerBridgePresentation,
  type ComputerBridgePresentation,
} from '@auth/computerBridge';

export const computerBridgePresentationQueryKey = ['computerBridgePresentation'] as const;

export function useComputerPresentation(
  bridgeId: string,
  enabled: boolean,
): { data: ComputerBridgePresentation | null | undefined; settled: boolean } {
  const query = useQuery<ComputerBridgePresentation | null>({
    queryKey: [...computerBridgePresentationQueryKey, bridgeId],
    queryFn: () => getComputerBridgePresentation(bridgeId).catch(() => null),
    enabled: enabled && bridgeId.length > 0,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: () =>
      AppState.currentState === 'active' ? 30_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return { data: query.data, settled: query.isFetched };
}

export function useComputerGrants(bridgeId: string, enabled: boolean) {
  const { computers } = useConnections();
  const presentation = useComputerPresentation(bridgeId, enabled);
  const computer = computers.find((candidate) => candidate.bridgeId === bridgeId);

  if (presentation.data) {
    return { grants: presentation.data.grants, source: 'connector' as const };
  }
  if (!computer?.permissions) return undefined;
  return {
    grants: {
      viewSessions: computer.permissions.includes('session:content:read'),
      sendPrompts: computer.permissions.includes('session:prompt:send'),
      startSessions: computer.permissions.includes('session:create'),
    },
    source: 'pairing' as const,
  };
}
