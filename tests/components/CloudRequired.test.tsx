import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CloudRequiredScreen, CloudRequiredState } from '../../src/components/CloudRequired';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockSetConnectionMode = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../../src/store/preferences', () => ({
  useAppPreferences: (selector: (state: unknown) => unknown) =>
    selector({ setConnectionMode: mockSetConnectionMode }),
}));

describe('Cloud-required states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the title, explanatory message, and Cloud connection button', () => {
    const screen = render(
      <ThemeProvider>
        <CloudRequiredState message="Automations run in Devin Cloud." />
      </ThemeProvider>,
    );

    expect(screen.getByText('Needs Devin Cloud')).toBeTruthy();
    expect(screen.getByText('Automations run in Devin Cloud.')).toBeTruthy();
    expect(screen.getByText('Connect Devin Cloud')).toBeTruthy();
  });

  it('sets Cloud mode before replacing the route with credentials', () => {
    const screen = render(
      <ThemeProvider>
        <CloudRequiredState message="Connect Devin Cloud to continue." />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Connect Devin Cloud'));

    expect(mockSetConnectionMode).toHaveBeenCalledWith('cloud');
    expect(mockReplace).toHaveBeenCalledWith('/(onboarding)/credentials');
    expect(mockSetConnectionMode.mock.invocationCallOrder[0]!).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]!,
    );
  });

  it('renders the titled screen without a New action', () => {
    const screen = render(
      <ThemeProvider>
        <CloudRequiredScreen title="Automations" message="Automations need Devin Cloud." />
      </ThemeProvider>,
    );

    expect(screen.getByText('Automations')).toBeTruthy();
    expect(screen.getByText('Needs Devin Cloud')).toBeTruthy();
    expect(screen.queryByText('New')).toBeNull();
  });
});
