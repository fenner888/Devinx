import type { ReactNode } from 'react';
import { Image, useWindowDimensions, View } from 'react-native';

import HOME_COMPANION_STAGE from '../../../assets/pets/devin/home-companion-stage.jpg';
import { useTheme } from '@theme/index';

const BACKGROUND_WIDTH = 1280;
const BACKGROUND_HEIGHT = 853;
const FLOOR_RING_Y = 760;

export function HomeCompanionStage({
  companionSize,
  children,
}: {
  companionSize: number;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const { name, tokens } = useTheme();
  const stageWidth = Math.min(Math.max(width - 40, 280), 620);
  const stageHeight = companionSize + 24;
  const backgroundScale = Math.max(stageWidth / BACKGROUND_WIDTH, stageHeight / BACKGROUND_HEIGHT);
  const backgroundWidth = BACKGROUND_WIDTH * backgroundScale;
  const backgroundHeight = BACKGROUND_HEIGHT * backgroundScale;
  const backgroundLeft = (stageWidth - backgroundWidth) / 2;
  const backgroundTop = Math.min(0, stageHeight - 12 - FLOOR_RING_Y * backgroundScale);

  return (
    <View
      className="w-full items-center justify-center overflow-hidden"
      style={{ height: stageHeight }}
      testID="home-companion-stage"
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute items-center overflow-hidden"
        style={{ width: stageWidth, height: stageHeight }}
        testID="home-companion-stage-backdrop"
      >
        {name === 'dark' ? (
          <Image
            source={HOME_COMPANION_STAGE}
            resizeMode="cover"
            className="absolute"
            style={{
              left: backgroundLeft,
              top: backgroundTop,
              width: backgroundWidth,
              height: backgroundHeight,
            }}
            testID="home-companion-stage-image"
          />
        ) : (
          <View
            className="absolute bottom-1 rounded-full"
            style={{
              width: Math.min(companionSize * 1.2, stageWidth * 0.7),
              height: Math.max(22, companionSize * 0.14),
              backgroundColor: tokens.companionStageGlow.hex,
            }}
            testID="home-companion-stage-light-halo"
          />
        )}
      </View>

      <View
        className="items-center justify-center"
        style={{ width: companionSize, height: companionSize }}
      >
        {children}
      </View>
    </View>
  );
}
