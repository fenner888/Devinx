import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RefreshControl, ScrollView } from 'react-native';

import type { ComputerSessionBoard } from '../../src/api/bridge/queries';

let mockComputerBoard: ComputerSessionBoard;
const mockRefetchComputerSessions = jest.fn(async () => undefined);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
  hapticWarning: jest.fn(),
}));
jest.mock('@store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ pinnedSessionIds: [], togglePin: jest.fn() }),
}));
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => ({ mode: 'computer' }),
}));
jest.mock('@api/devin/queries', () => ({
  useSessions: () => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useArchiveSession: () => ({ mutate: jest.fn() }),
  useTerminateSession: () => ({ mutate: jest.fn() }),
}));
jest.mock('@api/bridge/queries', () => ({
  COMPUTER_SESSIONS_REFRESH_INTERVAL_MS: 30_000,
  useComputerSessions: () => ({
    data: mockComputerBoard,
    isLoading: false,
    error: null,
    refetch: mockRefetchComputerSessions,
    isRefetching: false,
  }),
}));

import SessionsScreen from '../../src/app/(main)/sessions';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('Computer-only sessions screen', () => {
  beforeEach(() => {
    mockRefetchComputerSessions.mockClear();
    mockComputerBoard = {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'DevinX',
          hasTitle: true,
          bridgeId: 'bridge_1234567890',
          computerName: 'Studio Mac',
          canLoad: false,
        },
      ],
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'ready' }],
      lastSuccessfulAt: Date.now(),
    };
  });

  it('omits the only Mac name visually but keeps it accessible and shows list freshness', () => {
    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('DevinX')).toBeTruthy();
    expect(screen.queryByText('Studio Mac')).toBeNull();
    expect(screen.getByLabelText(/on Studio Mac/)).toBeTruthy();
    expect(screen.getByText('Session title hidden')).toBeTruthy();
    expect(
      screen.getByText('Local list updated just now · refreshes every 30s'),
    ).toBeTruthy();
    expect(screen.queryByText(/^Tags/)).toBeNull();
    expect(screen.queryByText('No sessions yet')).toBeNull();
  });

  it('shows the computer name when multiple Macs are paired', () => {
    mockComputerBoard.computers.push({
      bridgeId: 'bridge_0987654321',
      computerName: 'Travel Mac',
      state: 'ready',
    });

    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Studio Mac')).toBeTruthy();
  });

  it('shows freshness in the empty-state branch and omits it without a timestamp', () => {
    mockComputerBoard.sessions = [];
    const emptyScreen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(emptyScreen.getByText('No sessions yet')).toBeTruthy();
    expect(
      emptyScreen.getByText('Local list updated just now · refreshes every 30s'),
    ).toBeTruthy();
    emptyScreen.unmount();

    mockComputerBoard.sessions = [
      {
        id: `local_${'L'.repeat(43)}`,
        origin: 'computer',
        workspaceName: 'DevinX',
        hasTitle: true,
        bridgeId: 'bridge_1234567890',
        computerName: 'Studio Mac',
        canLoad: false,
      },
    ];
    mockComputerBoard.lastSuccessfulAt = undefined;
    const noTimestampScreen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(noTimestampScreen.queryByText(/Local list updated/)).toBeNull();
  });

  it('uses local-only search copy when no session matches', () => {
    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Search sessions…'), 'no-match');

    expect(screen.getByText('No sessions match your search.')).toBeTruthy();
  });

  it('shows the blocked empty state when all local computers are non-ready', () => {
    mockComputerBoard.sessions = [];
    mockComputerBoard.computers = [
      { bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'unavailable' },
      { bridgeId: 'bridge_0987654321', computerName: 'Travel Mac', state: 'busy' },
    ];

    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Local sessions unavailable')).toBeTruthy();
    expect(screen.getByText('Fix the connection above, then pull down to refresh.')).toBeTruthy();
  });

  it('refreshes from the blocked empty state', () => {
    mockComputerBoard.sessions = [];
    mockComputerBoard.computers = [
      { bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'unavailable' },
    ];

    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.refreshControl.type).toBe(RefreshControl);
    scrollView.props.refreshControl.props.onRefresh();

    expect(mockRefetchComputerSessions).toHaveBeenCalledTimes(1);
  });

  it('keeps the regular empty state when any local computer is ready', () => {
    mockComputerBoard.sessions = [];
    mockComputerBoard.computers = [
      { bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'ready' },
      { bridgeId: 'bridge_0987654321', computerName: 'Travel Mac', state: 'unavailable' },
    ];

    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('No sessions yet')).toBeTruthy();
    expect(screen.queryByText('Local sessions unavailable')).toBeNull();
  });
});
