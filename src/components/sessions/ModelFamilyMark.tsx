import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { modelFamilyMarkKind } from '@lib/model-family-mark';
import { useTheme } from '@theme/index';

interface ModelFamilyMarkProps {
  name: string | null | undefined;
  size?: number;
}

export function ModelFamilyMark({ name, size = 24 }: ModelFamilyMarkProps) {
  const { tokens } = useTheme();
  const kind = modelFamilyMarkKind(name);
  const iconSize = Math.max(16, Math.round(size * 0.82));

  let mark: React.ReactNode;
  switch (kind) {
    case 'adaptive':
      mark = <Ionicons name="git-branch-outline" size={iconSize} color={tokens.merged.hex} />;
      break;
    case 'claude':
      mark = (
        <Text
          style={{ color: tokens.blocked.hex, fontSize: iconSize + 2, lineHeight: iconSize + 3 }}
          className="font-semibold"
        >
          ✳
        </Text>
      );
      break;
    case 'glm':
      mark = (
        <Text
          style={{
            color: tokens.textHiStrong.hex,
            fontSize: iconSize + 2,
            lineHeight: iconSize + 3,
          }}
          className="font-bold"
        >
          Z
        </Text>
      );
      break;
    case 'swe': {
      const dot = Math.max(4, Math.round(size * 0.22));
      mark = (
        <View
          className="flex-row flex-wrap items-center justify-center"
          style={{ width: iconSize, height: iconSize }}
        >
          <View
            className="m-px rounded-sm"
            style={{
              width: dot,
              height: dot,
              backgroundColor: tokens.brandText.hex,
            }}
          />
          <View
            className="m-px rounded-sm"
            style={{
              width: dot,
              height: dot,
              backgroundColor: tokens.running.hex,
            }}
          />
          <View
            className="m-px rounded-sm"
            style={{
              width: dot,
              height: dot,
              backgroundColor: tokens.finished.hex,
            }}
          />
          <View
            className="m-px rounded-sm"
            style={{
              width: dot,
              height: dot,
              backgroundColor: tokens.brand.hex,
            }}
          />
        </View>
      );
      break;
    }
    case 'gpt':
      mark = <Ionicons name="aperture-outline" size={iconSize} color={tokens.finished.hex} />;
      break;
    case 'gemini':
      mark = <Ionicons name="sparkles" size={iconSize} color={tokens.merged.hex} />;
      break;
    case 'deepseek':
      mark = <Ionicons name="water-outline" size={iconSize} color={tokens.brandText.hex} />;
      break;
    case 'grok':
      mark = (
        <Text
          style={{ color: tokens.textHiStrong.hex, fontSize: iconSize, lineHeight: iconSize + 2 }}
          className="font-semibold"
        >
          X
        </Text>
      );
      break;
    default:
      mark = <Ionicons name="hardware-chip-outline" size={iconSize} color={tokens.textMid.hex} />;
  }

  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size }}
      accessible={false}
      importantForAccessibility="no"
      testID={`model-family-mark-${kind}`}
    >
      {mark}
    </View>
  );
}
