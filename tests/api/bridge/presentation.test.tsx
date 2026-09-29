import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetComputerBridgePresentation = jest.fn();

jest.mock('@auth/computerBridge', () => ({
  getComputerBridgePresentation: (bridgeId: string) =>
    mockGetComputerBridgePresentation(bridgeId),
}));

import { useComputerPresentation } from '../../../src/api/bridge/presentation';

describe('useComputerPresentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deduplicates in-flight requests and serves the fresh cached value', async () => {
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

    const first = renderHook(() => useComputerPresentation(bridgeId, true));
    const second = renderHook(() => useComputerPresentation(bridgeId, true));

    expect(first.result.current).toEqual({ data: undefined, settled: false });
    expect(second.result.current).toEqual({ data: undefined, settled: false });
    await waitFor(() => expect(mockGetComputerBridgePresentation).toHaveBeenCalledTimes(1));

    act(() => resolveRequest(presentation));
    await waitFor(() =>
      expect(first.result.current).toEqual({ data: presentation, settled: true }),
    );
    await waitFor(() =>
      expect(second.result.current).toEqual({ data: presentation, settled: true }),
    );
    first.unmount();
    second.unmount();

    const cached = renderHook(() => useComputerPresentation(bridgeId, true));
    expect(cached.result.current).toEqual({ data: presentation, settled: true });
    expect(mockGetComputerBridgePresentation).toHaveBeenCalledTimes(1);
    cached.unmount();
  });

  it('does not fetch when disabled or when the bridge ID is empty', () => {
    const disabled = renderHook(() => useComputerPresentation('bridge_presentation_disabled', false));
    const empty = renderHook(() => useComputerPresentation('', true));

    expect(disabled.result.current).toEqual({ data: undefined, settled: false });
    expect(empty.result.current).toEqual({ data: undefined, settled: false });
    expect(mockGetComputerBridgePresentation).not.toHaveBeenCalled();

    disabled.unmount();
    empty.unmount();
  });
});
