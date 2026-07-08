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

/** Daily total — `acus` may be omitted by the API; fall back to the product sum. */
function dayTotal(d: DailyConsumptionResponse): number {
  return d.acus ?? Object.values(d.acus_by_product).reduce((sum, v) => sum + v, 0);
}

/** ACUs are fractional — show one decimal only when needed. */
function formatAcu(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

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
  const totals = recent.map(dayTotal);
  const maxAcu = Math.max(...totals, 1);
  const totalAcu = totals.reduce((sum, t) => sum + t, 0);

  return (
    <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
      <Text className="text-text-low text-text12 font-medium uppercase mb-1">ACU Consumption</Text>
      <Text className="text-text-hi text-text17 mb-4">{formatAcu(totalAcu)} ACU · last {recent.length} days</Text>

      {/* Bar chart */}
      <View className="flex-row items-end justify-between" style={{ height: CHART_HEIGHT }}>
        {recent.map((d, i) => {
          const height = maxAcu > 0 ? ((totals[i] ?? 0) / maxAcu) * (CHART_HEIGHT - 4) : 0;
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
          {recent[0]?.date.slice(0, 10) ?? '—'}
        </Text>
        <Text className="text-text-low text-text11">
          {recent[recent.length - 1]?.date.slice(0, 10) ?? '—'}
        </Text>
      </View>
    </View>
  );
}

const PRODUCT_COLORS = ['text-brand-text', 'text-finished', 'text-blocked', 'text-merged', 'text-link'];

function productLabel(key: string): string {
  const label = key.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ConsumptionSummary({ data }: { data: DailyConsumptionResponse[] }) {
  const recent = data.slice(-30);

  // Product keys vary by org/era — aggregate whatever the API returns.
  const byProduct = new Map<string, number>();
  for (const d of recent) {
    for (const [product, acus] of Object.entries(d.acus_by_product)) {
      byProduct.set(product, (byProduct.get(product) ?? 0) + acus);
    }
  }
  const rows = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  const totalAll = rows.reduce((sum, [, v]) => sum + v, 0);

  if (rows.length === 0) {
    return (
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">By product (30 days)</Text>
        <Text className="text-text-mid text-text13">No per-product breakdown available.</Text>
      </View>
    );
  }

  return (
    <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
      <Text className="text-text-low text-text12 font-medium uppercase mb-3">By product (30 days)</Text>
      {rows.map(([product, value], i) => (
        <View key={product} className={`flex-row items-center py-2 ${i < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}>
          <Text className="text-text-mid text-text13 flex-1">{productLabel(product)}</Text>
          <Text className={`text-text14 font-medium ${PRODUCT_COLORS[i % PRODUCT_COLORS.length]}`}>
            {formatAcu(value)} ACU
          </Text>
          <Text className="text-text-low text-text12 ml-2">
            ({totalAll > 0 ? Math.round((value / totalAll) * 100) : 0}%)
          </Text>
        </View>
      ))}
      <View className="flex-row items-center pt-3 border-t border-border-subtle">
        <Text className="text-text-hi text-text14 flex-1 font-medium">Total</Text>
        <Text className="text-text-hi text-text14 font-medium">{formatAcu(totalAll)} ACU</Text>
      </View>
    </View>
  );
}
