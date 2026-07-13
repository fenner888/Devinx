import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useTheme } from '@theme/index';

const STAR_POINTS = [
  { x: 0.08, y: 0.17, size: 2, opacity: 0.42 },
  { x: 0.16, y: 0.34, size: 1, opacity: 0.62 },
  { x: 0.24, y: 0.12, size: 1, opacity: 0.4 },
  { x: 0.33, y: 0.27, size: 2, opacity: 0.28 },
  { x: 0.43, y: 0.08, size: 1, opacity: 0.48 },
  { x: 0.56, y: 0.19, size: 1, opacity: 0.36 },
  { x: 0.67, y: 0.1, size: 2, opacity: 0.28 },
  { x: 0.76, y: 0.31, size: 1, opacity: 0.52 },
  { x: 0.86, y: 0.16, size: 2, opacity: 0.36 },
  { x: 0.93, y: 0.38, size: 1, opacity: 0.46 },
] as const;

const ORBIT_RINGS = [
  { scale: 1, opacity: 0.56 },
  { scale: 0.76, opacity: 0.34 },
] as const;

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
  const horizonWidth = stageWidth * 1.18;
  const horizonHeight = Math.max(92, companionSize * 0.48);
  const ringWidth = Math.min(companionSize * 1.08, stageWidth * 0.72);

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
        {name === 'dark' &&
          STAR_POINTS.map((star, index) => (
            <View
              key={index}
              className="absolute rounded-full"
              style={{
                left: Math.round(stageWidth * star.x),
                top: Math.round(stageHeight * star.y),
                width: star.size,
                height: star.size,
                opacity: star.opacity,
                backgroundColor: tokens.companionStageStar.hex,
              }}
              testID="home-companion-stage-star"
            />
          ))}

        <View
          className="absolute rounded-full"
          style={{
            bottom: -Math.round(horizonHeight * 0.05),
            width: horizonWidth * 0.72,
            height: horizonHeight * 0.72,
            backgroundColor: tokens.companionStageGlow.hex,
          }}
        />
        <View
          className="absolute rounded-full border"
          style={{
            bottom: -Math.round(horizonHeight * 0.28),
            width: horizonWidth,
            height: horizonHeight,
            borderColor: tokens.companionStageLine.hex,
            backgroundColor: tokens.companionStageSurface.hex,
          }}
          testID="home-companion-stage-horizon"
        />
        {ORBIT_RINGS.map((orbit) => (
          <View
            key={orbit.scale}
            className="absolute rounded-full border"
            style={{
              bottom: 7 + Math.round((1 - orbit.scale) * 10),
              width: ringWidth * orbit.scale,
              height: Math.max(18, ringWidth * 0.14 * orbit.scale),
              borderColor: tokens.companionStageLine.hex,
              opacity: orbit.opacity,
            }}
            testID="home-companion-stage-orbit"
          />
        ))}
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
