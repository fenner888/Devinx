import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockPollingMode: 'battery_saver' | 'balanced' | 'fast' = 'balanced';
const mockSetPollingMode = jest.fn((mode: typeof mockPollingMode) => {
  mockPollingMode = mode;
});
const mockPreferenceState = {
  get pollingMode() {
    return mockPollingMode;
  },
  setPollingMode: mockSetPollingMode,
  hapticsEnabled: false,
  setHaptics: jest.fn(),
  defaultTags: [] as string[],
  setDefaultTags: jest.fn(),
  resetUserScopedData: jest.fn(),
};

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@auth/AuthContext', () => ({
  useAuth: () => ({ provider: null, isAuthenticated: false }),
}));
jest.mock('@auth/ConnectionContext', () => ({
  useConnections: () => ({
    mode: 'computer',
    hasCloudConnection: false,
    hasComputerConnection: false,
    computers: [],
    connectionError: null,
    disconnectAll: jest.fn(),
  }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: jest.fn() }) }));
jest.mock('@api/devin/queries', () => ({ useSelf: () => ({ data: undefined }) }));
jest.mock('@store/preferences', () => ({
  normalizeDefaultTags: (input: string) => input.split(',').map((tag) => tag.trim()),
  useAppPreferences: (selector: (state: typeof mockPreferenceState) => unknown) =>
    selector(mockPreferenceState),
}));
jest.mock('@theme/index', () => ({
  setThemePreference: jest.fn(),
  useThemePreference: () => 'system',
  useTheme: () => ({
    tokens: {
      brandText: { hex: 'brand' },
      textMid: { hex: 'mid' },
      textLow: { hex: 'low' },
      finished: { hex: 'finished' },
      merged: { hex: 'merged' },
      blocked: { hex: 'blocked' },
      textAlwaysWhite: { hex: 'white' },
    },
  }),
}));
jest.mock('@cache/index', () => ({ purgeCache: jest.fn(async () => {}) }));
jest.mock('@lib/localUserData', () => ({ purgeUserScopedStorage: jest.fn(async () => {}) }));
jest.mock('@lib/confirm', () => ({ confirmAction: jest.fn() }));

import SettingsScreen from '../../src/app/(main)/settings';

describe('Settings polling guidance', () => {
  beforeEach(() => {
    mockPollingMode = 'balanced';
    mockSetPollingMode.mockClear();
  });

  it('describes the selected Cloud cadence and fixed Local refresh', () => {
    const screen = render(<SettingsScreen />);

    expect(
      screen.getByText(
        'Balanced · Devin Cloud session list every 15 s while a session is running (1 min when idle). Open sessions check for new messages every 2.5 s.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Applies to Devin Cloud only. Local sessions refresh every 30 s while the app is open, whatever you choose here.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Fast'));
    screen.rerender(<SettingsScreen />);

    expect(
      screen.getByText(
        'Fast · Devin Cloud session list every 7.5 s while a session is running (30 s when idle). Open sessions check for new messages every 1.3 s.',
      ),
    ).toBeTruthy();
  });
});
