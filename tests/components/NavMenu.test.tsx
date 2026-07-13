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
  it('always exposes Security and routes to the native access-aware screen', () => {
    const onClose = jest.fn();
    const screen = render(
      <ThemeProvider>
        <NavMenu visible onClose={onClose} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Security'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(main)/security');
  });
});
