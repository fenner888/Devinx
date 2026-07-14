import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';

import { modelFamilyMarkKind } from '@lib/model-family-mark';
import { useTheme } from '@theme/index';
import { MODEL_FAMILY_MARK_ASSETS } from './modelFamilyMarkAssets';

interface ModelFamilyMarkProps {
  name: string | null | undefined;
  size?: number;
}

export function ModelFamilyMark({ name, size = 24 }: ModelFamilyMarkProps) {
  const { tokens } = useTheme();
  const kind = modelFamilyMarkKind(name);
  const iconSize = Math.max(16, Math.round(size * 0.82));
  const asset = MODEL_FAMILY_MARK_ASSETS[kind];

  let mark: React.ReactNode;
  if (asset) {
    const imageSize = Math.max(14, Math.round(size * asset.scale));
    mark = (
      <View className="items-center justify-center">
        <Image
          source={asset.source}
          resizeMode="contain"
          style={{
            width: imageSize,
            height: imageSize,
            tintColor: asset.tintWithTheme ? tokens.textHiStrong.hex : undefined,
          }}
          accessible={false}
          testID={`model-family-mark-image-${kind}`}
        />
      </View>
    );
  } else {
    switch (kind) {
      case 'adaptive':
        mark = <Ionicons name="git-branch-outline" size={iconSize} color={tokens.merged.hex} />;
        break;
      default:
        mark = <Ionicons name="hardware-chip-outline" size={iconSize} color={tokens.textMid.hex} />;
    }
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
