/**
 * Analytics — org metrics (v3 metrics API), mirroring the web Settings →
 * Analytics page: Sessions stats + by-size/by-origin distributions,
 * Pull requests funnel, searches, and active-user metrics.
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrgMetrics } from '@api/devin/queries';
import { ApiError } from '@api/devin/client';
import { userFacingError } from '@lib/user-facing-error';
import { useTheme } from '@theme/index';

const RANGES = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
];

/** Size buckets ordered as in the web analytics legend (XS→XL). */
const SIZE_ORDER = ['xs', 's', 'm', 'l', 'xl'];

function StatPair({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View className="flex-row flex-wrap">
      {items.map(({ label, value }) => (
        <View key={label} className="w-1/2 mb-3 pr-2">
          <Text className="text-text-low text-text12">{label}</Text>
          <Text className="text-text-hi text-text17 mt-0.5">{value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Horizontal distribution bar + legend rows (replaces web time-series). */
function Distribution({ data, colorFor }: { data: Record<string, number>; colorFor?: (key: string, i: number) => string }) {
  const { tokens } = useTheme();
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a[0]);
      const bi = SIZE_ORDER.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return b[1] - a[1];
    });
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) {
    return <Text className="text-text-low text-text12">No data in this range.</Text>;
  }
  // Web legend palette (XS→XL: blue/green/amber/orange/red), from theme tokens.
  const sizeColors: Record<string, string> = {
    xs: tokens.brand.hex,
    s: tokens.finished.hex,
    m: tokens.chartAmber.hex,
    l: tokens.blocked.hex,
    xl: tokens.failed.hex,
  };
  const fallbackPalette = [tokens.brand.hex, tokens.finished.hex, tokens.merged.hex, tokens.blocked.hex, tokens.chartAmber.hex, tokens.failed.hex];
  const color = (key: string, i: number) =>
    colorFor?.(key, i) ?? sizeColors[key] ?? fallbackPalette[i % fallbackPalette.length] ?? tokens.brand.hex;

  return (
    <View>
      <View className="flex-row h-2.5 rounded-chip overflow-hidden mb-2">
        {entries.map(([key, value], i) => (
          <View key={key} style={{ flex: value, backgroundColor: color(key, i) }} />
        ))}
      </View>
      {entries.map(([key, value], i) => (
        <View key={key} className="flex-row items-center py-1">
          <View className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: color(key, i) }} />
          <Text className="text-text-mid text-text13 flex-1 uppercase">{key}</Text>
          <Text className="text-text-hi text-text13">{value}</Text>
          <Text className="text-text-low text-text12 ml-2">({Math.round((value / total) * 100)}%)</Text>
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [rangeDays, setRangeDays] = useState(30);
  const { data, isLoading, error, refetch, isRefetching } = useOrgMetrics(rangeDays);

  const isPermissionError = error instanceof ApiError && error.code === 'permission';
  const sessions = data?.sessions;
  const prs = data?.prs;
  const mergeRate =
    prs?.prs_created_count && prs.prs_merged_count != null && prs.prs_created_count > 0
      ? `${Math.round((prs.prs_merged_count / prs.prs_created_count) * 100)}%`
      : '—';
  const wau = data?.weeklyActiveUsers ?? [];
  const maxWau = Math.max(...wau.map((w) => w.active_users), 1);
  const dau = data?.dailyActiveUsers ?? [];
  const mau = data?.monthlyActiveUsers ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17 flex-1">Analytics</Text>
        <View className="flex-row bg-tint-secondary rounded-chip p-0.5">
          {RANGES.map(({ days, label }) => (
            <Pressable
              key={days}
              className={`rounded-chip px-3 py-1 ${rangeDays === days ? 'bg-surface2' : ''}`}
              onPress={() => setRangeDays(days)}
            >
              <Text className={`text-text12 font-medium ${rangeDays === days ? 'text-text-hi' : 'text-text-mid'}`}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {isPermissionError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-hi text-text14 text-center mb-2">Analytics unavailable</Text>
          <Text className="text-text-mid text-text13 text-center">
            This service user lacks the analytics permission for the organization.
          </Text>
        </View>
      )}

      {error && !isPermissionError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-failed text-text14 mb-2">Could not load analytics</Text>
          <Text className="text-text-mid text-text13 text-center mb-4">
            {userFacingError(error, 'Analytics are unavailable right now.')}
          </Text>
          <Pressable className="bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY" onPress={() => refetch()}>
            <Text className="text-brand-text text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      )}

      {sessions && (
        <ScrollView
          className="flex-1 px-4 py-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {/* Sessions */}
          <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
            <Text className="text-text-low text-text12 font-medium uppercase mb-3">Sessions</Text>
            <StatPair
              items={[
                { label: 'Sessions created', value: String(sessions.sessions_created_count) },
                { label: 'ACU / session', value: sessions.avg_acus_per_session.toFixed(2) },
                { label: 'With playbook', value: String(sessions.sessions_created_with_playbook_count) },
                { label: 'With merged PR', value: String(sessions.sessions_with_merged_prs_count) },
              ]}
            />
            <Text className="text-text-low text-text12 font-medium uppercase mb-2 mt-1">By size</Text>
            <Distribution data={sessions.sessions_created_by_size} />
          </View>

          {/* By origin */}
          <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
            <Text className="text-text-low text-text12 font-medium uppercase mb-2">Sessions by origin</Text>
            <Distribution data={sessions.sessions_created_by_origin} />
          </View>

          {/* Pull requests */}
          <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
            <Text className="text-text-low text-text12 font-medium uppercase mb-3">Pull requests</Text>
            <StatPair
              items={[
                { label: 'PRs created', value: String(prs?.prs_created_count ?? '—') },
                { label: 'PRs merged', value: String(prs?.prs_merged_count ?? '—') },
                { label: 'Merge rate', value: mergeRate },
                { label: 'Searches', value: String(data?.searches.searches_created_count ?? '—') },
              ]}
            />
          </View>

          {/* Active users */}
          {(data.activeUsers || dau.length > 0 || wau.length > 0 || mau.length > 0) && (
            <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
              <Text className="text-text-low text-text12 font-medium uppercase mb-3">
                Active users
              </Text>
              <StatPair
                items={[
                  {
                    label: `Unique · ${rangeDays}d`,
                    value: String(data.activeUsers?.active_users ?? '—'),
                  },
                  {
                    label: 'Latest day',
                    value: String(dau[dau.length - 1]?.active_users ?? '—'),
                  },
                  {
                    label: 'Latest week',
                    value: String(wau[wau.length - 1]?.active_users ?? '—'),
                  },
                  {
                    label: 'Latest month',
                    value: String(mau[mau.length - 1]?.active_users ?? '—'),
                  },
                ]}
              />
              {wau.length > 0 && (
                <>
                  <View className="flex-row items-end justify-between h-20">
                    {wau.map((w, i) => (
                      <View
                        key={`${w.start_time}-${i}`}
                        className="flex-1 bg-brand rounded-t-sm mx-0.5"
                        style={{ height: Math.max((w.active_users / maxWau) * 72, 2) }}
                      />
                    ))}
                  </View>
                  <Text className="text-text-low text-text11 mt-2">
                    {wau.length} weekly periods
                  </Text>
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
