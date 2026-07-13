import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ConnectionsScreen from '../../src/app/(main)/connections';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockRefetch = jest.fn();
const mockUseAuth = jest.fn(() => ({ isAuthenticated: true }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('@auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/api/devin/mcpQueries', () => ({
  useIntegrationCatalog: () => ({
    data: {
      integrations: [
        {
          id: 'github',
          name: 'GitHub',
          description: 'Source control',
          kind: 'integration',
          status: 'installed',
        },
      ],
      mcpServers: [
        {
          id: 'sentry',
          name: 'Sentry',
          description: 'Issue investigation',
          kind: 'mcp',
          status: 'not_installed',
        },
      ],
    },
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

describe('Connections & MCP screen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
  });

  it('shows documented read-only integration and MCP status without install controls', () => {
    const screen = render(
      <ThemeProvider>
        <ConnectionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('GitHub')).toBeTruthy();
    expect(screen.getByText('Installed')).toBeTruthy();
    expect(screen.queryByText('Install')).toBeNull();
    expect(screen.queryByText('Configure')).toBeNull();

    fireEvent.press(screen.getByText('MCP servers'));
    expect(screen.getByText('Sentry')).toBeTruthy();
    expect(screen.getByText('Not installed')).toBeTruthy();
  });

  it('does not expose the catalog when Cloud access is inactive', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    const screen = render(
      <ThemeProvider>
        <ConnectionsScreen />
      </ThemeProvider>,
    );

    expect(screen.getByText('Devin Cloud is not active')).toBeTruthy();
    expect(screen.queryByText('GitHub')).toBeNull();
  });
});
