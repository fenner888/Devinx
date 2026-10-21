import type { ReactNode } from 'react';
import { Image, View } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@theme/index', () => ({
  useTheme: () => ({ name: 'dark' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}));

import ICON_WELCOME from '../../assets/brand/icon-welcome.png';
import WelcomeScreen from '../../src/app/(onboarding)/index';

describe('Welcome screen', () => {
  it('renders the app icon hidden from accessibility alongside the wordmark', () => {
    const screen = render(<WelcomeScreen />);
    const logo = screen
      .UNSAFE_getAllByType(Image)
      .find(({ props }) => props.testID === 'welcome-app-icon');
    const branding = screen
      .UNSAFE_getAllByType(View)
      .find(({ props }) => props.testID === 'welcome-branding');

    expect(logo?.props.source).toEqual(ICON_WELCOME);
    expect(logo?.props.accessible).toBe(false);
    expect(branding?.props.accessibilityElementsHidden).toBe(true);
  });
});
