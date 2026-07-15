import React from 'react';
import { render } from '@testing-library/react-native';

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
  useComputerSessions: () => ({
    data: {
      sessions: [
        {
          id: `local_${'L'.repeat(43)}`,
          origin: 'computer',
          workspaceName: 'DevinX',
          hasTitle: true,
          bridgeId: 'bridge_1234567890',
          computerName: 'Studio Mac',
        },
      ],
      computers: [{ bridgeId: 'bridge_1234567890', computerName: 'Studio Mac', state: 'ready' }],
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

import SessionsScreen from '../../src/app/(main)/sessions';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('Computer-only sessions screen', () => {
  it('shows local metadata with an explicit Mac origin and no Cloud-only tag control', () => {
    const screen = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('DevinX')).toBeTruthy();
    expect(screen.getByText('Studio Mac')).toBeTruthy();
    expect(screen.getByText('Session title hidden')).toBeTruthy();
    expect(screen.queryByText(/^Tags/)).toBeNull();
    expect(screen.queryByText('No sessions yet')).toBeNull();
  });
});
