import { Text, View } from 'react-native';

import type { ComputerModelCostTier } from '@lib/computer-model-catalog';
import { useTheme } from '@theme/index';

interface ModelCostIndicatorProps {
  costTier?: ComputerModelCostTier;
  costSummary?: string;
}

const COST_LEVELS: Record<Exclude<ComputerModelCostTier, 'free'>, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function modelCostLabel(
  costTier?: ComputerModelCostTier,
  costSummary?: string,
): string | null {
  if (costTier === 'free') return 'Free';
  if (costTier) return `${costTier[0]?.toUpperCase()}${costTier.slice(1)} cost`;
  if (costSummary) return 'Variable cost';
  return null;
}

export function ModelCostIndicator({ costTier, costSummary }: ModelCostIndicatorProps) {
  const { tokens } = useTheme();
  const label = modelCostLabel(costTier, costSummary);
  if (!label) return null;

  if (costTier === 'free') {
    return (
      <Text
        className="min-w-10 text-right text-brand-text text-text12 font-medium"
        accessibilityLabel="Free model"
      >
        Free
      </Text>
    );
  }

  const activeSegments = costTier ? COST_LEVELS[costTier] : 3;
  const colors = [tokens.finished.hex, tokens.chartAmber.hex, tokens.blocked.hex];
  return (
    <View
      className="w-10 flex-row items-center justify-end"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Model cost: ${label}`}
      accessibilityHint={costSummary}
    >
      {colors.map((color, index) => (
        <View
          key={color}
          className="ml-0.5 h-1.5 w-2 rounded-full"
          style={{
            backgroundColor: index < activeSegments ? color : tokens.borderSubtle.hex,
          }}
        />
      ))}
    </View>
  );
}
