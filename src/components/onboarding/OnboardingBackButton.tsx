import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '@theme/index';

export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();

  return (
    <Pressable
      className="w-11 h-11 rounded-chip bg-tint-secondary items-center justify-center"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={20} color={tokens.textMid.hex} />
    </Pressable>
  );
}
