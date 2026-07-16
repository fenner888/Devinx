import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReact = React;
const mockPressable = Pressable;
const mockText = Text;

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRefreshComputers = jest.fn(async () => {});
const mockGetComputerBridgeVersion = jest.fn<
  Promise<{ kind: 'supported'; version: string } | { kind: 'legacy' }>,
  []
>(async () => ({ kind: 'supported', version: '0.1.2' }));
let mockComputers: Array<{
  bridgeId: string;
  computerName: string;
  pairedAt: number;
  permissions: Array<'bridge:health' | 'session:metadata:read'>;
  transportKind: 'tailscale_vpn';
}> = [];
const mockPairComputer = jest.fn(
  async (_payload: string, options: { onStatus?: (status: string) => void }) => {
    options.onStatus?.('waiting_for_approval');
    return {
      bridgeId: 'bridge_1234567890',
      computerName: 'My Mac',
      pairedAt: 1_800_000_000_000,
      permissions: ['bridge:health', 'session:metadata:read'],
    };
  },
);
const mockGetPermission = jest.fn(async () => 'authorized');
const mockRequestPermission = jest.fn(async () => 'authorized');
const mockSetConnectionMode = jest.fn();
let mockConnectionMode = 'computer';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({ computers: mockComputers, refreshComputers: mockRefreshComputers }),
}));

jest.mock('../../src/auth/computerBridge', () => {
  const actual = jest.requireActual('../../src/auth/computerBridge');
  return {
    ...actual,
    getComputerBridgeVersion: () => mockGetComputerBridgeVersion(),
  };
});

jest.mock('../../src/auth/computerPairing', () => ({
  pairComputerFromQrPayload: (payload: string, options: { onStatus?: (status: string) => void }) =>
    mockPairComputer(payload, options),
}));

jest.mock('../../src/auth/deviceSigning', () => ({
  getQrScannerPermissionStatus: () => mockGetPermission(),
  isQrScannerAvailable: () => true,
  requestQrScannerPermission: () => mockRequestPermission(),
}));

jest.mock('../../src/components/connections/DevinXQrScanner', () => {
  return {
    DevinXQrScanner: ({ onCode }: { onCode: (payload: string) => void }) =>
      mockReact.createElement(
        mockPressable,
        { testID: 'qr-scanner', onPress: () => onCode('{"pairing":"offer"}') },
        mockReact.createElement(mockText, null, 'Camera preview'),
      ),
  };
});

jest.mock('../../src/store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ connectionMode: mockConnectionMode, setConnectionMode: mockSetConnectionMode }),
}));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      textMid: { hex: '#777777' },
      brandText: { hex: '#0088ff' },
      textLow: { hex: '#666666' },
      brand: { hex: '#0088ff' },
      finished: { hex: '#00aa66' },
      textAlwaysWhite: { hex: '#ffffff' },
    },
  }),
}));

import ComputerConnectionScreen from '../../src/app/(onboarding)/computer';

describe('Computer connection onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectionMode = 'computer';
    mockComputers = [];
    mockGetComputerBridgeVersion.mockResolvedValue({ kind: 'supported', version: '0.1.2' });
    mockGetPermission.mockResolvedValue('authorized');
    mockRequestPermission.mockResolvedValue('authorized');
  });

  it('shows the real pairing instructions and starts the scanner after permission', async () => {
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText('Connect your Mac')).toBeTruthy();
    expect(screen.getByText('Name this Mac')).toBeTruthy();
    expect(screen.getByText('Open Tailscale setup guide')).toBeTruthy();
    expect(screen.getByText('Set up DevinX Connector')).toBeTruthy();
    expect(screen.getByText('Send assisted setup prompt')).toBeTruthy();
    expect(screen.getByText('Open official releases')).toBeTruthy();
    expect(
      screen.getByText(/Tailscale alone does not expose Devin sessions/),
    ).toBeTruthy();
    expect(screen.queryByText('Pairing transport pending')).toBeNull();

    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() => expect(screen.getByTestId('qr-scanner')).toBeTruthy());
    expect(
      screen.getByText('Point your camera at the code shown in DevinX Connector.'),
    ).toBeTruthy();
    expect(screen.getByText('Hold the code inside the frame.')).toBeTruthy();
    expect(screen.getByLabelText('Cancel QR scanning')).toBeTruthy();
    expect(mockGetPermission).toHaveBeenCalledTimes(1);
  });

  it('offers one Tailscale path without a same-Wi-Fi fallback', () => {
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText(/Tailscale supplies the private network/)).toBeTruthy();
    expect(screen.getByText(/Connector supplies the local Devin service/)).toBeTruthy();
    expect(screen.queryByText('Same Wi-Fi')).toBeNull();
    expect(screen.getByLabelText('Scan DevinX Connector pairing code')).toBeTruthy();
  });

  it('identifies computer pairing as the second step of combined setup', () => {
    mockConnectionMode = 'both';
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText('STEP 2 OF 2')).toBeTruthy();
    expect(screen.getByText('Pair your computer')).toBeTruthy();
    expect(screen.getByText(/Devin Cloud is connected/)).toBeTruthy();
    expect(screen.queryByText('Connect your Mac')).toBeNull();
  });

  it('shows an official update action for a legacy Connector', async () => {
    mockComputers = [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'My Mac',
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read'],
        transportKind: 'tailscale_vpn',
      },
    ];
    mockGetComputerBridgeVersion.mockResolvedValueOnce({ kind: 'legacy' });

    const screen = render(<ComputerConnectionScreen />);

    await waitFor(() => expect(screen.getByText('Connector update required')).toBeTruthy());
    expect(screen.getByLabelText('Open official DevinX Connector update')).toBeTruthy();
    expect(screen.getByText(/0.1.2 or later/)).toBeTruthy();
  });

  it('keeps the Mac name reachable above the keyboard and supports dismissal', () => {
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByTestId('computer-connection-keyboard-viewport')).toBeTruthy();
    expect(screen.getByTestId('computer-connection-scroll').props.keyboardDismissMode).toBe(
      'interactive',
    );
    expect(screen.getByTestId('computer-connection-scroll').props.keyboardShouldPersistTaps).toBe(
      'handled',
    );
    expect(screen.getByLabelText('Paired Mac name').props.returnKeyType).toBe('done');
  });

  it('requests first-use permission and sends a scanned payload directly to pairing', async () => {
    mockGetPermission.mockResolvedValueOnce('notDetermined');
    const screen = render(<ComputerConnectionScreen />);

    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() => expect(screen.getByTestId('qr-scanner')).toBeTruthy());
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('qr-scanner'));
    await waitFor(() => expect(mockPairComputer).toHaveBeenCalledTimes(1));
    expect(mockPairComputer).toHaveBeenCalledWith(
      '{"pairing":"offer"}',
      expect.objectContaining({ computerName: 'My Mac', signal: expect.any(Object) }),
    );
    await waitFor(() => expect(mockRefreshComputers).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(main)');
  });

  it('does not mount the camera when permission is denied', async () => {
    mockGetPermission.mockResolvedValueOnce('denied');
    const screen = render(<ComputerConnectionScreen />);

    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() =>
      expect(
        screen.getByText('Camera access is required to scan the DevinX Connector pairing code.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId('qr-scanner')).toBeNull();
    expect(screen.getByText('Open Settings')).toBeTruthy();
    expect(mockPairComputer).not.toHaveBeenCalled();
  });

  it('shows a useful private-network recovery message when the connector is unreachable', async () => {
    mockPairComputer.mockRejectedValueOnce({ code: 'ERR_PINNED_HTTPS_NETWORK' });
    const screen = render(<ComputerConnectionScreen />);

    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() => expect(screen.getByTestId('qr-scanner')).toBeTruthy());
    fireEvent.press(screen.getByTestId('qr-scanner'));

    await waitFor(() =>
      expect(
        screen.getByText(/Confirm Tailscale is connected on this iPhone and Mac/),
      ).toBeTruthy(),
    );
  });
});
