import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetComputerBridgePresentation = jest.fn();

jest.mock('@auth/computerBridge', () => ({
  getComputerBridgePresentation: (bridgeId: string) =>
    mockGetComputerBridgePresentation(bridgeId),
}));
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => ({
    computers: [
      {
        bridgeId: 'bridge_presentation_grants',
        permissions: ['bridge:health', 'session:metadata:read'],
      },
    ],
  }),
}));

import {
  computerBridgePresentationQueryKey,
  useComputerGrants,
  useComputerPresentation,
} from '../../../src/api/bridge/presentation';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useComputerPresentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deduplicates in-flight requests and serves the query value', async () => {
    const bridgeId = 'bridge_presentation_hook_dedupe';
    const presentation = {
      messageTimestamps: true,
      grants: { viewSessions: true, sendPrompts: false, startSessions: true },
    };
    let resolveRequest!: (value: typeof presentation) => void;
    mockGetComputerBridgePresentation.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const first = renderHook(() => useComputerPresentation(bridgeId, true), { wrapper });
    const second = renderHook(() => useComputerPresentation(bridgeId, true), { wrapper });

    expect(first.result.current).toEqual({ data: undefined, settled: false });
    expect(second.result.current).toEqual({ data: undefined, settled: false });
    await waitFor(() => expect(mockGetComputerBridgePresentation).toHaveBeenCalledTimes(1));

    await act(async () => resolveRequest(presentation));
    await waitFor(() =>
      expect(first.result.current).toEqual({ data: presentation, settled: true }),
    );
    await waitFor(() =>
      expect(second.result.current).toEqual({ data: presentation, settled: true }),
    );
    first.unmount();
    second.unmount();

    const cached = renderHook(() => useComputerPresentation(bridgeId, true), { wrapper });
    expect(cached.result.current).toEqual({ data: presentation, settled: true });
    expect(mockGetComputerBridgePresentation).toHaveBeenCalledTimes(1);
    cached.unmount();
  });

  it('updates grants after the presentation query is invalidated', async () => {
    const bridgeId = 'bridge_presentation_grants';
    const initial = {
      messageTimestamps: true,
      grants: { viewSessions: true, sendPrompts: false, startSessions: false },
    };
    const refreshed = {
      messageTimestamps: true,
      grants: { viewSessions: true, sendPrompts: true, startSessions: true },
    };
    mockGetComputerBridgePresentation
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(refreshed);
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);
    const hook = renderHook(() => useComputerGrants(bridgeId, true), { wrapper });

    await waitFor(() => expect(hook.result.current?.grants).toEqual(initial.grants));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: computerBridgePresentationQueryKey });
    });
    await waitFor(() => expect(hook.result.current?.grants).toEqual(refreshed.grants));
    expect(mockGetComputerBridgePresentation).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it('does not fetch when disabled or when the bridge ID is empty', () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);
    const disabled = renderHook(
      () => useComputerPresentation('bridge_presentation_disabled', false),
      { wrapper },
    );
    const empty = renderHook(() => useComputerPresentation('', true), { wrapper });

    expect(disabled.result.current).toEqual({ data: undefined, settled: false });
    expect(empty.result.current).toEqual({ data: undefined, settled: false });
    expect(mockGetComputerBridgePresentation).not.toHaveBeenCalled();

    disabled.unmount();
    empty.unmount();
  });
});
