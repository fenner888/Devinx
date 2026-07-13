import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { HomeCompanionStage } from '../../src/components/pets/HomeCompanionStage';
import { setThemeOverride, ThemeProvider } from '../../src/theme/ThemeProvider';

describe('HomeCompanionStage', () => {
  afterEach(() => {
    act(() => setThemeOverride(null));
  });

  it('keeps the approved dark atmosphere decorative and confined to the companion area', () => {
    setThemeOverride('dark');
    const screen = render(
      <ThemeProvider>
        <HomeCompanionStage companionSize={200}>
          <View testID="companion-content" />
        </HomeCompanionStage>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('home-companion-stage').props.style).toEqual({ height: 224 });
    expect(
      screen.getAllByTestId('home-companion-stage-star', { includeHiddenElements: true }),
    ).toHaveLength(10);
    expect(
      screen.getAllByTestId('home-companion-stage-orbit', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByTestId('companion-content')).toBeTruthy();

    const backdrop = screen.getByTestId('home-companion-stage-backdrop', {
      includeHiddenElements: true,
    });
    expect(backdrop.props.pointerEvents).toBe('none');
    expect(backdrop.props.accessibilityElementsHidden).toBe(true);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('uses the quiet light treatment without rendering the dark star field', () => {
    setThemeOverride('light');
    const screen = render(
      <ThemeProvider>
        <HomeCompanionStage companionSize={184}>
          <View />
        </HomeCompanionStage>
      </ThemeProvider>,
    );

    expect(
      screen.queryAllByTestId('home-companion-stage-star', { includeHiddenElements: true }),
    ).toHaveLength(0);
    expect(
      screen.getByTestId('home-companion-stage-horizon', { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
