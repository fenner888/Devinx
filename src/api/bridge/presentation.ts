import { useEffect, useState } from 'react';

import { useConnections } from '@auth/ConnectionContext';
import {
  getComputerBridgePresentation,
  type ComputerBridgePresentation,
} from '@auth/computerBridge';

const PRESENTATION_CACHE_TTL_MS = 60_000;

interface CachedPresentation {
  value: ComputerBridgePresentation | null;
  fetchedAt: number;
}

interface PresentationState {
  bridgeId: string;
  enabled: boolean;
  data: ComputerBridgePresentation | null | undefined;
  settled: boolean;
}

const presentationCache = new Map<string, CachedPresentation>();
const presentationRequests = new Map<string, Promise<ComputerBridgePresentation | null>>();

function getCachedPresentation(bridgeId: string): CachedPresentation | undefined {
  const cached = presentationCache.get(bridgeId);
  if (!cached) return undefined;
  if (Date.now() - cached.fetchedAt >= PRESENTATION_CACHE_TTL_MS) {
    presentationCache.delete(bridgeId);
    return undefined;
  }
  return cached;
}

function requestPresentation(bridgeId: string): Promise<ComputerBridgePresentation | null> {
  const existing = presentationRequests.get(bridgeId);
  if (existing) return existing;

  const request = getComputerBridgePresentation(bridgeId)
    .catch(() => null)
    .then((value) => {
      presentationCache.set(bridgeId, { value, fetchedAt: Date.now() });
      return value;
    });
  presentationRequests.set(bridgeId, request);
  request.then(() => {
    if (presentationRequests.get(bridgeId) === request) {
      presentationRequests.delete(bridgeId);
    }
  });
  return request;
}

export function useComputerPresentation(
  bridgeId: string,
  enabled: boolean,
): { data: ComputerBridgePresentation | null | undefined; settled: boolean } {
  const [state, setState] = useState<PresentationState>({
    bridgeId: '',
    enabled: false,
    data: undefined,
    settled: false,
  });
  const active = enabled && bridgeId.length > 0;
  const cached = active ? getCachedPresentation(bridgeId) : undefined;
  const current =
    active && state.bridgeId === bridgeId && state.enabled
      ? state
      : active && cached
        ? { bridgeId, enabled: true, data: cached.value, settled: true }
        : { bridgeId, enabled: active, data: undefined, settled: false };

  useEffect(() => {
    if (!active) {
      setState({ bridgeId, enabled: false, data: undefined, settled: false });
      return;
    }

    const fresh = getCachedPresentation(bridgeId);
    if (fresh) {
      setState({ bridgeId, enabled: true, data: fresh.value, settled: true });
      return;
    }

    let mounted = true;
    setState({ bridgeId, enabled: true, data: undefined, settled: false });
    requestPresentation(bridgeId).then((data) => {
      if (mounted) setState({ bridgeId, enabled: true, data, settled: true });
    });
    return () => {
      mounted = false;
    };
  }, [active, bridgeId]);

  return { data: current.data, settled: current.settled };
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
