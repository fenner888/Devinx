import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockConnectionMode = 'cloud';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('../../src/auth/pendingCredentials', () => ({
  setPendingCredentials: jest.fn(),
}));

jest.mock('../../src/store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ connectionMode: mockConnectionMode }),
}));

jest.mock('../../src/theme/index', () => ({
  useTheme: () => ({
    tokens: {
      brandText: { hex: '#0088ff' },
      textAlwaysWhite: { hex: '#ffffff' },
      textHi: { hex: '#ffffff' },
      textMid: { hex: '#999999' },
      textLow: { hex: '#666666' },
    },
  }),
}));

const mockSetPendingCredentials = jest.requireMock(
  '../../src/auth/pendingCredentials',
).setPendingCredentials as jest.Mock;

import CredentialsScreen from '../../src/app/(onboarding)/credentials';

describe('Cloud credential onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectionMode = 'cloud';
  });

  it('retains the single-provider Cloud setup copy', () => {
    const screen = render(<CredentialsScreen />);

    expect(screen.getByText('Connect Devin Cloud')).toBeTruthy();
    expect(screen.getByText('Validate & connect')).toBeTruthy();
    expect(screen.queryByText('STEP 1 OF 2')).toBeNull();
  });

  it('identifies Cloud as the first step of combined setup', () => {
    mockConnectionMode = 'both';
    const screen = render(<CredentialsScreen />);

    expect(screen.getByText('STEP 1 OF 2')).toBeTruthy();
    expect(screen.getByText('Connect Cloud & continue')).toBeTruthy();
    expect(screen.getByText(/Next, you’ll pair a local device/)).toBeTruthy();
  });

  it('opens an in-app service-user walkthrough before external links', () => {
    const screen = render(<CredentialsScreen />);

    fireEvent.press(screen.getByLabelText('Open service user instructions'));

    expect(screen.getByText('Create your Devin service user')).toBeTruthy();
    expect(screen.getByText('Open Service users')).toBeTruthy();
    expect(screen.getByText('Create a scoped service user')).toBeTruthy();
    expect(screen.getByText('Generate its API key')).toBeTruthy();
    expect(screen.getByText('Copy your organization ID')).toBeTruthy();
    expect(screen.getByLabelText('Open Devin')).toBeTruthy();
    expect(
      screen.getByLabelText('Read official Devin authentication documentation'),
    ).toBeTruthy();
  });

  it('preserves and submits an org_ identifier for authenticated validation', () => {
    const screen = render(<CredentialsScreen />);

    fireEvent.changeText(screen.getByTestId('api-key-input'), 'cog_testkey');
    fireEvent.changeText(screen.getByTestId('org-id-input'), '  org_legacy123  ');
    fireEvent.press(screen.getByLabelText('Validate and connect Devin Cloud'));

    expect(mockSetPendingCredentials).toHaveBeenCalledWith({
      apiKey: 'cog_testkey',
      attributionUserId: undefined,
      kind: 'service_user',
      orgId: 'org_legacy123',
    });
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/validate');
  });
});
