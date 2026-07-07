/**
 * Usage screen — ACU consumption dashboard.
 * Shows daily ACU breakdown for the last 30 days with a bar chart.
 */
import { View, Text, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDailyConsumption } from '@api/devin/queries';
import { useTheme } from '@theme/index';
import type { DailyConsumptionResponse } from '@api/devin/types';

const BAR_WIDTH = 4;
const CHART_HEIGHT = 112;

export default function UsageScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useDailyConsumption();
  const { tokens } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17">Usage & limits</Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {error && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-failed text-text14 mb-2">Could not load usage data</Text>
          <Text className="text-text-mid text-text13 text-center mb-4">{error.message}</Text>
          <Pressable
            className="bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={() => refetch()}
          >
            <Text className="text-brand-text text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <ScrollView className="flex-1 px-4 py-4">
          <ConsumptionChart data={data} />
          <ConsumptionSummary data={data} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ConsumptionChart({ data }: { data: DailyConsumptionResponse[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = width - 64; // screen padding + card padding
  const maxBars = Math.max(1, Math.floor(chartWidth / (BAR_WIDTH + 2)));

  // Take last N days that fit the chart.
  const recent = data.slice(-maxBars);
  const maxAcu = Math.max(...recent.map((d) => d.acus), 1);
  const totalAcu = recent.reduce((sum, d) => sum + d.acus, 0);

  return (
    <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
      <Text className="text-text-low text-text12 font-medium uppercase mb-1">ACU Consumption</Text>
      <Text className="text-text-hi text-text17 mb-4">{totalAcu} ACU · last {recent.length} days</Text>

      {/* Bar chart */}
      <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
        {recent.map((d) => {
          const height = maxAcu > 0 ? (d.acus / maxAcu) * (CHART_HEIGHT - 4) : 0;
          return (
            <View
              key={d.date}
              className="bg-brand rounded-t-sm mr-0.5"
              style={{ width: BAR_WIDTH, height: Math.max(height, 2) }}
            />
          );
        })}
      </View>

      {/* Date range */}
      <View className="flex-row justify-between mt-2">
        <Text className="text-text-low text-text11">
          {recent[0]?.date ?? '—'}
        </Text>
        <Text className="text-text-low text-text11">
          {recent[recent.length - 1]?.date ?? '—'}
        </Text>
      </View>
    </View>
  );
}

function ConsumptionSummary({ data }: { data: DailyConsumptionResponse[] }) {
  const recent = data.slice(-30);
  const totalDevin = recent.reduce((sum, d) => sum + d.acus_by_product.devin, 0);
  const totalCascade = recent.reduce((sum, d) => sum + d.acus_by_product.cascade, 0);
  const totalTerminal = recent.reduce((sum, d) => sum + d.acus_by_product.terminal, 0);
  const totalAll = totalDevin + totalCascade + totalTerminal;

  const rows: { label: string; value: number; color: string }[] = [
    { label: 'Devin', value: totalDevin, color: 'text-brand-text' },
    { label: 'Cascade', value: totalCascade, color: 'text-finished' },
    { label: 'Terminal', value: totalTerminal, color: 'text-blocked' },
  ];

  return (
    <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
      <Text className="text-text-low text-text12 font-medium uppercase mb-3">By product (30 days)</Text>
      {rows.map(({ label, value, color }, i) => (
        <View key={label} className={`flex-row items-center py-2 ${i < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}>
          <Text className="text-text-mid text-text13 flex-1">{label}</Text>
          <Text className={`text-text14 font-medium ${color}`}>
            {value} ACU
          </Text>
          <Text className="text-text-low text-text12 ml-2">
            ({totalAll > 0 ? Math.round((value / totalAll) * 100) : 0}%)
          </Text>
        </View>
      ))}
      <View className="flex-row items-center pt-3 border-t border-border-subtle">
        <Text className="text-text-hi text-text14 flex-1 font-medium">Total</Text>
        <Text className="text-text-hi text-text14 font-medium">{totalAll} ACU</Text>
      </View>
    </View>
  );
}
