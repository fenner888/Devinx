import { View } from 'react-native';

interface OnboardingProgressProps {
  current: number;
  total: number;
}

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Onboarding step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current }}
      testID="onboarding-progress"
    >
      {Array.from({ length: total }, (_, index) => {
        const active = index + 1 === current;
        return (
          <View
            key={index}
            className={`h-2 rounded-chip ${active ? 'w-8 bg-brand' : 'w-2 bg-tint-primary'}`}
            testID={active ? 'onboarding-progress-active' : undefined}
          />
        );
      })}
    </View>
  );
}
