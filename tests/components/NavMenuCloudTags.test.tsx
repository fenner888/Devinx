import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NavMenu } from '../../src/components/NavMenu';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

const mockPush = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@lib/haptics', () => ({ hapticLight: jest.fn() }));

describe('NavMenu Cloud tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows three Cloud tags and keeps Automations navigation active', () => {
    const onClose = jest.fn();
    const screen = render(
      <ThemeProvider>
        <NavMenu visible onClose={onClose} showCloudTags />
      </ThemeProvider>,
    );

    expect(screen.getAllByText('Cloud')).toHaveLength(3);
    expect(screen.getByLabelText('Automations').props.accessibilityHint).toBe(
      'Requires Devin Cloud',
    );

    fireEvent.press(screen.getByLabelText('Automations'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(main)/automations');
  });

  it('hides Cloud tags when showCloudTags is omitted', () => {
    const screen = render(
      <ThemeProvider>
        <NavMenu visible onClose={jest.fn()} />
      </ThemeProvider>,
    );

    expect(screen.queryAllByText('Cloud')).toHaveLength(0);
  });
});
