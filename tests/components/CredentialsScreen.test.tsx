import React from 'react';
import { render } from '@testing-library/react-native';

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
      textHi: { hex: '#ffffff' },
      textLow: { hex: '#666666' },
    },
  }),
}));

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
    expect(screen.getByText(/Next, you’ll pair your computer/)).toBeTruthy();
  });
});
