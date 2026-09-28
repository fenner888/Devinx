import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockReact = React;
const mockPressable = Pressable;
const mockText = Text;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack };
const mockSetConnectionMode = jest.fn();
const mockRefreshComputers = jest.fn(async () => {});
const mockGetComputerBridgeVersion = jest.fn<
  Promise<{ kind: 'supported'; version: string } | { kind: 'legacy' }>,
  []
>(async () => ({ kind: 'supported', version: '0.1.2' }));
const mockSetPendingCredentials = jest.fn();
const mockTakePendingCredentials = jest.fn(() => ({
  kind: 'service_user' as const,
  apiKey: 'cog_testkey',
  orgId: 'org-test123',
}));
const mockConnect = jest.fn<Promise<{ ok: boolean; detail?: string }>, []>(async () => ({
  ok: true,
}));
let mockValidationResult: { ok: boolean; detail?: string } = { ok: true };
let mockConnectionMode = 'computer';
let mockComputers: Array<{
  bridgeId: string;
  computerName: string;
  pairedAt: number;
  permissions: Array<'bridge:health' | 'session:metadata:read'>;
  transportKind: 'tailscale_vpn';
}> = [];

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/auth/ConnectionContext', () => ({
  useConnections: () => ({ computers: mockComputers, refreshComputers: mockRefreshComputers }),
}));

jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ connect: mockConnect }),
}));

jest.mock('../../src/auth/computerBridge', () => {
  const actual = jest.requireActual('../../src/auth/computerBridge');
  return {
    ...actual,
    getComputerBridgeVersion: () => mockGetComputerBridgeVersion(),
  };
});

jest.mock('../../src/auth/computerPairing', () => ({
  pairComputerFromQrPayload: jest.fn(),
}));

jest.mock('../../src/auth/deviceSigning', () => ({
  getQrScannerPermissionStatus: jest.fn(async () => 'authorized'),
  isQrScannerAvailable: () => true,
  requestQrScannerPermission: jest.fn(async () => 'authorized'),
}));

jest.mock('../../src/auth/pendingCredentials', () => ({
  setPendingCredentials: (...args: unknown[]) => mockSetPendingCredentials(...args),
  takePendingCredentials: () => mockTakePendingCredentials(),
}));

jest.mock('../../src/components/connections/DevinXQrScanner', () => ({
  DevinXQrScanner: ({ onCode }: { onCode: (payload: string) => void }) =>
    mockReact.createElement(
      mockPressable,
      { testID: 'qr-scanner', onPress: () => onCode('{"pairing":"offer"}') },
      mockReact.createElement(mockText, null, 'Camera preview'),
    ),
}));

jest.mock('../../src/store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ connectionMode: mockConnectionMode, setConnectionMode: mockSetConnectionMode }),
}));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      brandText: { hex: 'blue' },
      textAlwaysWhite: { hex: 'white' },
      textHi: { hex: 'white' },
      textMid: { hex: 'gray' },
      textLow: { hex: 'gray' },
      brand: { hex: 'blue' },
      finished: { hex: 'green' },
      failed: { hex: 'red' },
    },
  }),
}));

import ComputerConnectionScreen from '../../src/app/(onboarding)/computer';
import CredentialsScreen from '../../src/app/(onboarding)/credentials';
import ValidateScreen from '../../src/app/(onboarding)/validate';

describe('adding Devin Cloud to Local', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockConnectionMode = 'computer';
    mockComputers = [];
    mockGetComputerBridgeVersion.mockResolvedValue({ kind: 'supported', version: '0.1.2' });
    mockTakePendingCredentials.mockReturnValue({
      kind: 'service_user',
      apiKey: 'cog_testkey',
      orgId: 'org-test123',
    });
    mockValidationResult = { ok: true };
    mockConnect.mockImplementation(async () => mockValidationResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers to also connect Cloud and preserves mode for an existing pairing', () => {
    mockComputers = [
      {
        bridgeId: 'bridge_1234567890',
        computerName: 'My Mac',
        pairedAt: 1_800_000_000_000,
        permissions: ['bridge:health', 'session:metadata:read'],
        transportKind: 'tailscale_vpn',
      },
    ];
    mockGetComputerBridgeVersion.mockReturnValue(new Promise(() => {}));
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText('Also connect Devin Cloud')).toBeTruthy();
    expect(screen.getByText('Your paired devices stay connected.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Also connect Devin Cloud'));

    expect(mockPush).toHaveBeenCalledWith('/(main)/credentials');
    expect(mockSetConnectionMode).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps the switch-to-Cloud flow when no devices are paired', () => {
    const screen = render(<ComputerConnectionScreen />);

    expect(screen.getByText('Connect Devin Cloud instead')).toBeTruthy();
    expect(screen.queryByText('Your paired devices stay connected.')).toBeNull();

    fireEvent.press(screen.getByLabelText('Connect Devin Cloud instead'));

    expect(mockSetConnectionMode).toHaveBeenCalledWith('cloud');
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/credentials');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('uses add-Cloud copy and validates through the main stack', () => {
    const screen = render(<CredentialsScreen />);

    expect(
      screen.getByText(
        'Your paired devices stay connected. DevinX stores the scoped credential in the iOS Keychain and never places it in logs or ordinary app storage.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('STEP 1 OF 2')).toBeNull();

    fireEvent.changeText(screen.getByTestId('api-key-input'), 'cog_testkey');
    fireEvent.changeText(screen.getByTestId('org-id-input'), 'org-test123');
    fireEvent.press(screen.getByLabelText('Validate and connect Devin Cloud'));

    expect(mockSetPendingCredentials).toHaveBeenCalledWith({
      kind: 'service_user',
      apiKey: 'cog_testkey',
      orgId: 'org-test123',
      attributionUserId: undefined,
    });
    expect(mockPush).toHaveBeenCalledWith('/(main)/validate');
  });

  it('switches to both after successful validation without restarting the effect', async () => {
    jest.useFakeTimers();
    const screen = render(<ValidateScreen />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Devin Cloud is ready')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockSetConnectionMode).toHaveBeenCalledWith('both');
    expect(mockReplace).toHaveBeenCalledWith('/(main)');
    expect(mockSetConnectionMode.mock.invocationCallOrder[0]!).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]!,
    );
    expect(mockTakePendingCredentials).toHaveBeenCalledTimes(1);
  });

  it('returns to main credentials after failure without changing Local mode', async () => {
    jest.useFakeTimers();
    mockValidationResult = { ok: false, detail: 'The credentials were rejected.' };
    const screen = render(<ValidateScreen />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Try again')).toBeTruthy();

    fireEvent.press(screen.getByText('Try again'));

    expect(mockReplace).toHaveBeenCalledWith('/(main)/credentials');
    expect(mockSetConnectionMode).not.toHaveBeenCalled();
  });

  it('preserves Cloud-only validation navigation and mode', async () => {
    jest.useFakeTimers();
    mockConnectionMode = 'cloud';
    const screen = render(<ValidateScreen />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Devin Cloud is ready')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockReplace).toHaveBeenCalledWith('/(main)');
    expect(mockSetConnectionMode).not.toHaveBeenCalled();
  });
});
