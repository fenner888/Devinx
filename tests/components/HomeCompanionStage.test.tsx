import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { HomeCompanionStage } from '../../src/components/pets/HomeCompanionStage';
import { setThemeOverride, ThemeProvider } from '../../src/theme/ThemeProvider';

describe('HomeCompanionStage', () => {
  afterEach(() => {
    act(() => setThemeOverride(null));
  });

  it('keeps the supplied dark space background decorative and confined to the companion area', () => {
    setThemeOverride('dark');
    const screen = render(
      <ThemeProvider>
        <HomeCompanionStage companionSize={200}>
          <View testID="companion-content" />
        </HomeCompanionStage>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('home-companion-stage').props.style).toEqual({ height: 224 });
    const image = screen.getByTestId('home-companion-stage-image', {
      includeHiddenElements: true,
    });
    expect(image.props.resizeMode).toBe('cover');
    expect(image.props.style.top).toBeLessThanOrEqual(0);
    expect(image.props.style.width).toBeGreaterThanOrEqual(350);
    expect(screen.getByTestId('companion-content')).toBeTruthy();

    const backdrop = screen.getByTestId('home-companion-stage-backdrop', {
      includeHiddenElements: true,
    });
    expect(backdrop.props.pointerEvents).toBe('none');
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('uses a quiet light halo without rendering a black image block', () => {
    setThemeOverride('light');
    const screen = render(
      <ThemeProvider>
        <HomeCompanionStage companionSize={184}>
          <View />
        </HomeCompanionStage>
      </ThemeProvider>,
    );

    expect(
      screen.queryByTestId('home-companion-stage-image', { includeHiddenElements: true }),
    ).toBeNull();
    expect(
      screen.getByTestId('home-companion-stage-light-halo', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
