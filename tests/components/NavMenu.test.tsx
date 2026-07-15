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
  it('exposes session-based Security Work without restoring the enterprise scan destination', () => {
    const onClose = jest.fn();
    const screen = render(
      <ThemeProvider>
        <NavMenu visible onClose={onClose} />
      </ThemeProvider>,
    );

    expect(screen.queryByLabelText('Security')).toBeNull();
    fireEvent.press(screen.getByLabelText('Security Work'));

    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/(main)/security-work');
  });
});
