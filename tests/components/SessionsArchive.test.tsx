const mockArchive = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
  hapticWarning: jest.fn(),
}));
jest.mock('@store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ pinnedSessionIds: [], togglePin: jest.fn() }),
}));
jest.mock('@api/devin/queries', () => ({
  useSessions: () => ({
    data: [
      {
        acus_consumed: 0,
        category: null,
        child_session_ids: null,
        created_at: 1,
        is_archived: false,
        org_id: 'org-1',
        origin: 'api',
        parent_session_id: null,
        playbook_id: null,
        pull_requests: [],
        service_user_id: null,
        session_id: 'devin-archive-me',
        status: 'running',
        tags: [],
        title: 'Archive me',
        updated_at: 2,
        url: 'https://app.devin.ai/sessions/devin-archive-me',
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useArchiveSession: () => ({ mutate: mockArchive }),
  useTerminateSession: () => ({ mutate: jest.fn() }),
}));
jest.mock('@api/bridge/queries', () => ({
  useComputerSessions: () => ({
    data: { sessions: [], computers: [] },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => ({ mode: 'cloud' }),
}));

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import SessionsScreen from '../../src/app/(main)/sessions';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('session archive action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the context modal mounted until the native confirmation resolves', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const view = render(
      <ThemeProvider>
        <SessionsScreen />
      </ThemeProvider>,
    );

    fireEvent(view.getByLabelText(/Archive me/), 'longPress');
    fireEvent.press(view.getByText('Archive (remove from board)'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(view.getByText('Open session')).toBeTruthy();

    const buttons = alertSpy.mock.calls[0]?.[2];
    const archiveButton = buttons?.find((button) => button.text === 'Archive');
    act(() => archiveButton?.onPress?.());

    expect(mockArchive).toHaveBeenCalledWith('devin-archive-me', expect.any(Object));
    expect(view.queryByText('Open session')).toBeNull();
  });
});
