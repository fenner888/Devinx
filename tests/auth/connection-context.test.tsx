import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

jest.mock('../../src/auth/keychain', () => ({
  wipeLegacyCloudCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/auth/pairedComputers', () => ({
  clearPairedComputers: jest.fn().mockResolvedValue(undefined),
  loadPairedComputerSummaries: jest.fn().mockResolvedValue([]),
}));

import { ConnectionProvider, useConnections } from '../../src/auth/ConnectionContext';
import { wipeLegacyCloudCredentials } from '../../src/auth/keychain';
import {
  clearPairedComputers,
  loadPairedComputerSummaries,
  type PairedComputerSummary,
} from '../../src/auth/pairedComputers';

function ConnectionProbe() {
  const { isConfigured, isLoading, disconnectAll } = useConnections();
  return (
    <View>
      <Text testID="configured">{String(isConfigured)}</Text>
      <Text testID="loading">{String(isLoading)}</Text>
      <Pressable testID="disconnect" onPress={disconnectAll}>
        <Text>Disconnect</Text>
      </Pressable>
    </View>
  );
}

describe('ConnectionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(wipeLegacyCloudCredentials).mockResolvedValue(undefined);
    jest.mocked(clearPairedComputers).mockResolvedValue(undefined);
    jest.mocked(loadPairedComputerSummaries).mockResolvedValue([]);
  });

  it('wipes legacy credentials on launch and disconnect', async () => {
    const screen = render(
      <ConnectionProvider>
        <ConnectionProbe />
      </ConnectionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('configured').props.children).toBe('false');
    expect(wipeLegacyCloudCredentials).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId('disconnect'));
    });

    await waitFor(() => expect(clearPairedComputers).toHaveBeenCalledTimes(1));
    expect(wipeLegacyCloudCredentials).toHaveBeenCalledTimes(2);
  });

  it('derives isConfigured from the paired-computer list', async () => {
    const emptyScreen = render(
      <ConnectionProvider>
        <ConnectionProbe />
      </ConnectionProvider>,
    );
    await waitFor(() => expect(emptyScreen.getByTestId('configured').props.children).toBe('false'));
    emptyScreen.unmount();

    jest.mocked(loadPairedComputerSummaries).mockResolvedValue([
      {
        bridgeId: 'bridge-1',
        computerName: 'My Mac',
        pairedAt: 0,
        permissions: [],
        transportKind: 'local_network',
      } satisfies PairedComputerSummary,
    ]);
    const pairedScreen = render(
      <ConnectionProvider>
        <ConnectionProbe />
      </ConnectionProvider>,
    );
    await waitFor(() => expect(pairedScreen.getByTestId('configured').props.children).toBe('true'));
  });
});
