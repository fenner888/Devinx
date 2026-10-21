import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@lib/haptics', () => ({ hapticLight: jest.fn() }));

import { NavMenu } from '../../src/components/NavMenu';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('NavMenu', () => {
  it('shows only Home, Sessions, Your Mac, and Settings destinations', () => {
    const onClose = jest.fn();
    const screen = render(
      <ThemeProvider>
        <NavMenu visible onClose={onClose} />
      </ThemeProvider>,
    );

    for (const item of ['New session', 'Sessions', 'Your Mac', 'Settings']) {
      expect(screen.getByLabelText(item)).toBeTruthy();
    }
    expect(screen.getByLabelText('Otterin')).toBeTruthy();
    for (const removedItem of [
      'Analytics',
      'Automations',
      'Knowledge',
      'Repositories',
      'Security Work',
      'Integrations & MCP',
    ]) {
      expect(screen.queryByLabelText(removedItem)).toBeNull();
    }

    fireEvent.press(screen.getByLabelText('New session'));
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(main)');
  });
});
