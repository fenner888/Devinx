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
const mockPairComputer = jest.fn(
  async (
    _payload: string,
    options: {
      computerName: string;
      useConnectorComputerName?: boolean;
      signal?: AbortSignal;
      onStatus?: (status: 'waiting_for_approval') => void;
    },
  ) => {
    options.onStatus?.('waiting_for_approval');
    return {
      bridgeId: 'bridge_1234567890',
      computerName: options.computerName,
      pairedAt: 1_800_000_000_000,
      permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
      transportKind: 'tailscale_vpn' as const,
    };
  },
);
const mockGetPermission = jest.fn(async () => 'authorized');
const mockRequestPermission = jest.fn(async () => 'authorized');
const mockSetConnectionMode = jest.fn();
let mockComputers: Array<{
  bridgeId: string;
  computerName: string;
  pairedAt: number;
  permissions: Array<
    | 'bridge:health'
    | 'session:metadata:read'
    | 'session:content:read'
    | 'session:prompt:send'
    | 'session:create'
  >;
  transportKind: 'tailscale_vpn';
}> = [];

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
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => ({ computers: mockComputers, refreshComputers: mockRefreshComputers }),
}));
jest.mock('@auth/computerBridge', () => {
  const actual = jest.requireActual('@auth/computerBridge');
  return {
    ...actual,
    getComputerBridgeVersion: () => mockGetComputerBridgeVersion(),
  };
});
jest.mock('@auth/computerPairing', () => ({
  pairComputerFromQrPayload: (
    payload: string,
    options: {
      computerName: string;
      useConnectorComputerName?: boolean;
      signal?: AbortSignal;
      onStatus?: (status: 'waiting_for_approval') => void;
    },
  ) => mockPairComputer(payload, options),
}));
jest.mock('@auth/deviceSigning', () => ({
  getQrScannerPermissionStatus: () => mockGetPermission(),
  isQrScannerAvailable: () => true,
  requestQrScannerPermission: () => mockRequestPermission(),
}));
jest.mock('@components/connections/DevinXQrScanner', () => ({
  DevinXQrScanner: ({ onCode }: { onCode: (payload: string) => void }) =>
    mockReact.createElement(
      mockPressable,
      { testID: 'qr-scanner', onPress: () => onCode('{"pairing":"offer"}') },
      mockReact.createElement(mockText, null, 'Camera preview'),
    ),
}));
jest.mock('@store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ connectionMode: 'computer', setConnectionMode: mockSetConnectionMode }),
}));
jest.mock('@theme/index', () => ({
  useTheme: () => ({
    tokens: {
      textMid: { hex: 'mid' },
      brandText: { hex: 'brand-text' },
      textLow: { hex: 'low' },
      brand: { hex: 'brand' },
      finished: { hex: 'finished' },
      failed: { hex: 'failed' },
      textAlwaysWhite: { hex: 'white' },
    },
  }),
}));

import ComputerConnectionScreen from '../../src/app/(onboarding)/computer';

describe('Phase 15 local-device pairing screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputers = [];
    mockGetComputerBridgeVersion.mockResolvedValue({ kind: 'supported', version: '0.1.2' });
    mockGetPermission.mockResolvedValue('authorized');
    mockRequestPermission.mockResolvedValue('authorized');
    mockPairComputer.mockImplementation(async (_payload, options) => {
      options.onStatus?.('waiting_for_approval');
      return {
        bridgeId: 'bridge_1234567890',
        computerName: options.computerName,
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
        transportKind: 'tailscale_vpn',
      };
    });
  });

  it('shows paired grants, opens their details, and keeps Disconnect separate', () => {
    mockComputers = [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'Studio Mac',
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
        transportKind: 'tailscale_vpn',
      },
    ];
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByLabelText('View sessions allowed')).toBeTruthy();
    expect(screen.getByLabelText('Send prompts not allowed')).toBeTruthy();
    expect(screen.getByLabelText('Start sessions not allowed')).toBeTruthy();
    expect(screen.getByLabelText('Disconnect Studio Mac')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Permissions for Studio Mac'));

    expect(screen.getByText('Permissions on Studio Mac')).toBeTruthy();
    expect(screen.getByText('Allowed')).toBeTruthy();
    expect(screen.getAllByText('Not allowed')).toHaveLength(2);
  });

  it('shows the setup guide on demand for paired devices and by default without devices', () => {
    mockComputers = [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'Studio Mac',
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
        transportKind: 'tailscale_vpn',
      },
    ];
    const pairedScreen = render(<ComputerConnectionScreen />);

    expect(pairedScreen.queryByLabelText('Open Tailscale setup guide')).toBeNull();
    fireEvent.press(pairedScreen.getByLabelText('How it works'));
    expect(pairedScreen.getByLabelText('Open Tailscale setup guide')).toBeTruthy();
    pairedScreen.unmount();

    mockComputers = [];
    const firstRunScreen = render(<ComputerConnectionScreen />);
    expect(firstRunScreen.getByLabelText('Open Tailscale setup guide')).toBeTruthy();
  });

  it('renders the scan control before the paired-device permission button', () => {
    mockComputers = [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'Studio Mac',
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read', 'session:content:read'],
        transportKind: 'tailscale_vpn',
      },
    ];
    const screen = render(<ComputerConnectionScreen />);
    const tree = JSON.stringify(screen.toJSON());

    expect(screen.getByLabelText('Scan DevinX Connector pairing code')).toBeTruthy();
    expect(screen.getByLabelText('Permissions for Studio Mac')).toBeTruthy();
    expect(tree.indexOf('Scan DevinX Connector pairing code')).toBeLessThan(
      tree.indexOf('Permissions for Studio Mac'),
    );
  });

  it('defaults the computer name to My Mac and uses the Connector name when untouched', async () => {
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText('Name this computer')).toBeTruthy();
    expect(screen.getByDisplayValue('My Mac')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() => expect(screen.getByTestId('qr-scanner')).toBeTruthy());
    fireEvent.press(screen.getByTestId('qr-scanner'));

    await waitFor(() =>
      expect(mockPairComputer).toHaveBeenCalledWith(
        '{"pairing":"offer"}',
        expect.objectContaining({
          computerName: 'My Mac',
          useConnectorComputerName: true,
        }),
      ),
    );
  });

  it('uses the entered name and disables the Connector name preference after editing', async () => {
    const screen = render(<ComputerConnectionScreen />);

    fireEvent.changeText(screen.getByLabelText('Paired local-device name'), 'Work PC');
    fireEvent.press(screen.getByLabelText('Scan DevinX Connector pairing code'));
    await waitFor(() => expect(screen.getByTestId('qr-scanner')).toBeTruthy());
    fireEvent.press(screen.getByTestId('qr-scanner'));

    await waitFor(() =>
      expect(mockPairComputer).toHaveBeenCalledWith(
        '{"pairing":"offer"}',
        expect.objectContaining({
          computerName: 'Work PC',
          useConnectorComputerName: false,
        }),
      ),
    );
  });
});
