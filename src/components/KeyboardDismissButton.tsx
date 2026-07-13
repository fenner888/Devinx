import { Keyboard, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@theme/index';

export function KeyboardDismissButton({ visible }: { visible: boolean }) {
  const { tokens } = useTheme();

  if (!visible) return null;

  return (
    <Pressable
      className="h-11 w-11 items-center justify-center rounded-full"
      onPress={() => Keyboard.dismiss()}
      accessibilityRole="button"
      accessibilityLabel="Hide keyboard"
      accessibilityHint="Dismisses the on-screen keyboard without clearing your message"
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      testID="session-keyboard-dismiss"
    >
      <Ionicons name="chevron-down" size={20} color={tokens.textMid.hex} />
    </Pressable>
  );
}
