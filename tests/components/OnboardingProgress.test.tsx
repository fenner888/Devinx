import { render } from '@testing-library/react-native';

import { OnboardingProgress } from '../../src/components/onboarding/OnboardingProgress';

describe('OnboardingProgress', () => {
  it('exposes the current page without relying on color alone', () => {
    const screen = render(<OnboardingProgress current={2} total={3} />);

    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({
      min: 1,
      max: 3,
      now: 2,
    });
    expect(screen.getAllByTestId('onboarding-progress-active')).toHaveLength(1);
  });
});
