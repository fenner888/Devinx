/**
 * Usage screen — ACU consumption.
 * Headline totals come from the org SESSION METRICS endpoint (works for all
 * plans, and is what the web Usage tab is built from). The per-day / per-
 * product breakdown from the consumption endpoint is shown ONLY when it
 * returns data (it's enterprise-billing-scoped and empty for self-serve orgs).
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useBillingLimits, useDailyConsumption, useOrgMetrics, type OrgMetricsBundle } from '@api/devin/queries';
import { ApiError } from '@api/devin/client';
import { userFacingError } from '@lib/user-facing-error';
import { useTheme } from '@theme/index';
import type { ConsumptionCycle, DailyConsumptionResponse, DevinAcuLimit } from '@api/devin/types';

type Tab = 'overview' | 'sessions' | 'reviews' | 'automations';

const BAR_WIDTH = 4;
const CHART_HEIGHT = 112;

/** Shared stat-pair grid. */
function StatGrid({ items }: { items: { label: string; value: string }[] }) {
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

const SIZE_ORDER = ['xs', 's', 'm', 'l', 'xl'];

/** Horizontal distribution bar + legend, matching the analytics palette. */
function Distribution({ data }: { data: Record<string, number> }) {
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
  if (total === 0) return <Text className="text-text-low text-text12">No data in this range.</Text>;
  const sizeColors: Record<string, string> = {
    xs: tokens.brand.hex, s: tokens.finished.hex, m: tokens.chartAmber.hex, l: tokens.blocked.hex, xl: tokens.failed.hex,
  };
  const palette = [tokens.brand.hex, tokens.finished.hex, tokens.merged.hex, tokens.blocked.hex, tokens.chartAmber.hex, tokens.failed.hex];
  const color = (k: string, i: number) => sizeColors[k] ?? palette[i % palette.length] ?? tokens.brand.hex;
  return (
    <View>
      <View className="flex-row h-2.5 rounded-chip overflow-hidden mb-2">
        {entries.map(([k, v], i) => (
          <View key={k} style={{ flex: v, backgroundColor: color(k, i) }} />
        ))}
      </View>
      {entries.map(([k, v], i) => (
        <View key={k} className="flex-row items-center py-1">
          <View className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: color(k, i) }} />
          <Text className="text-text-mid text-text13 flex-1">{k.replace(/_/g, ' ')}</Text>
          <Text className="text-text-hi text-text13">{v}</Text>
          <Text className="text-text-low text-text12 ml-2">({Math.round((v / total) * 100)}%)</Text>
        </View>
      ))}
    </View>
  );
}

/** Daily total — `acus` may be omitted by the API; fall back to the product sum. */
function dayTotal(d: DailyConsumptionResponse): number {
  return d.acus ?? Object.values(d.acus_by_product).reduce((sum, v) => sum + v, 0);
}

/** ACUs are fractional — show one decimal only when needed. */
function formatAcu(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'automations', label: 'Automations' },
];

export default function UsageScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');
  const metrics = useOrgMetrics(30);
  const { data: daily } = useDailyConsumption(45);
  const billing = useBillingLimits();

  const isPermissionError = metrics.error instanceof ApiError && metrics.error.code === 'permission';
  const bundle = metrics.data;

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
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

      {/* Tabs — mirror the web Usage & Limits page */}
      <View className="flex-row border-b border-border-subtle px-2">
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            className={`px-3 py-2.5 ${tab === key ? 'border-b-2 border-brand' : ''}`}
            onPress={() => setTab(key)}
          >
            <Text className={`text-text13 ${tab === key ? 'text-brand-text font-medium' : 'text-text-mid'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {metrics.isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {isPermissionError && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-text-hi text-text14 text-center mb-2">Usage unavailable</Text>
          <Text className="text-text-mid text-text13 text-center">
            This service user lacks the metrics permission for the organization.
          </Text>
        </View>
      )}

      {metrics.error && !isPermissionError && !bundle && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-failed text-text14 mb-2">Could not load usage data</Text>
          <Text className="text-text-mid text-text13 text-center mb-4">
            {userFacingError(metrics.error, 'Usage data is unavailable right now.')}
          </Text>
          <Pressable
            className="bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={() => metrics.refetch()}
          >
            <Text className="text-brand-text text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      )}

      {bundle && (
        <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {tab === 'overview' && (
            <OverviewTab
              bundle={bundle}
              daily={daily}
              billing={billing.data}
              billingPermissionDenied={
                billing.error instanceof ApiError && billing.error.code === 'permission'
              }
              billingFailed={!!billing.error}
              billingLoading={billing.isLoading}
            />
          )}
          {tab === 'sessions' && <SessionsTab bundle={bundle} />}
          {tab === 'reviews' && <ReviewsTab bundle={bundle} />}
          {tab === 'automations' && <AutomationsTab bundle={bundle} onManage={() => router.push('/(main)/automations')} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OverviewTab({
  bundle,
  daily,
  billing,
  billingPermissionDenied,
  billingFailed,
  billingLoading,
}: {
  bundle: OrgMetricsBundle;
  daily?: DailyConsumptionResponse[];
  billing?: { currentCycle?: ConsumptionCycle; orgLimit?: DevinAcuLimit };
  billingPermissionDenied: boolean;
  billingFailed: boolean;
  billingLoading: boolean;
}) {
  const s = bundle.sessions;
  const totalAcu = s.avg_acus_per_session * s.sessions_created_count;
  const hasDaily = !!daily && daily.length > 0;
  return (
    <>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">ACU consumption · last 30 days</Text>
        <StatGrid
          items={[
            { label: 'Total ACU', value: formatAcu(totalAcu) },
            { label: 'Sessions', value: String(s.sessions_created_count) },
            { label: 'ACU / session', value: s.avg_acus_per_session.toFixed(2) },
            { label: 'Merged PRs', value: String(s.sessions_with_merged_prs_count) },
          ]}
        />
      </View>
      {hasDaily && <ConsumptionChart data={daily} />}
      {hasDaily && <ConsumptionSummary data={daily} />}
      <PlanAndQuotas
        daily={daily}
        billing={billing}
        permissionDenied={billingPermissionDenied}
        failed={billingFailed}
        loading={billingLoading}
      />
    </>
  );
}

function SessionsTab({ bundle }: { bundle: OrgMetricsBundle }) {
  const s = bundle.sessions;
  return (
    <>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Sessions · last 30 days</Text>
        <StatGrid
          items={[
            { label: 'Created', value: String(s.sessions_created_count) },
            { label: 'ACU / session', value: s.avg_acus_per_session.toFixed(2) },
            { label: 'With playbook', value: String(s.sessions_created_with_playbook_count) },
            { label: 'With search', value: String(s.sessions_created_with_search_count) },
          ]}
        />
      </View>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">By size</Text>
        <Distribution data={s.sessions_created_by_size} />
      </View>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">By origin</Text>
        <Distribution data={s.sessions_created_by_origin} />
      </View>
    </>
  );
}

function ReviewsTab({ bundle }: { bundle: OrgMetricsBundle }) {
  const p = bundle.prs;
  const created = p.prs_created_count ?? 0;
  const merged = p.prs_merged_count ?? 0;
  const rate = created > 0 ? `${Math.round((merged / created) * 100)}%` : '—';
  return (
    <>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Pull requests · last 30 days</Text>
        <StatGrid
          items={[
            { label: 'Created', value: String(created) },
            { label: 'Merged', value: String(merged) },
            { label: 'Merge rate', value: rate },
            { label: 'Closed', value: String(p.prs_closed_count ?? 0) },
          ]}
        />
      </View>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Merged PRs by session size</Text>
        <Distribution data={bundle.sessions.sessions_with_merged_prs_by_size} />
      </View>
    </>
  );
}

function AutomationsTab({ bundle, onManage }: { bundle: OrgMetricsBundle; onManage: () => void }) {
  const { tokens } = useTheme();
  const byOrigin = bundle.sessions.sessions_created_by_origin;
  const automationSessions = byOrigin.automation ?? 0;
  return (
    <>
      <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Automations · last 30 days</Text>
        <StatGrid
          items={[
            { label: 'Automated sessions', value: String(automationSessions) },
            { label: 'Total sessions', value: String(bundle.sessions.sessions_created_count) },
          ]}
        />
        <Text className="text-text-low text-text12 mt-1">
          Sessions started by scheduled automations, of all sessions created in the range.
        </Text>
      </View>
      <Pressable
        className="flex-row items-center bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-4"
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel="Manage automations"
      >
        <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
          <Ionicons name="time-outline" size={15} color={tokens.brandText.hex} />
        </View>
        <Text className="text-text-hi text-text14 flex-1">Manage automations</Text>
        <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
      </Pressable>
    </>
  );
}

function dateFromUnix(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function cycleConsumption(
  daily: DailyConsumptionResponse[] | undefined,
  cycle?: ConsumptionCycle,
): number | undefined {
  if (!daily || !cycle) return undefined;
  const start = new Date(cycle.after * 1000).toISOString().slice(0, 10);
  const end = new Date(cycle.before * 1000).toISOString().slice(0, 10);
  return daily
    .filter((day) => day.date >= start && day.date < end)
    .reduce((total, day) => total + dayTotal(day), 0);
}

/**
 * Enterprise cycle and organization limits are rendered in-app when the
 * connected service user has ManageBilling. Self-serve allowance and credit
 * balance remain web-only because the Devin v3 API does not expose them.
 */
function PlanAndQuotas({
  daily,
  billing,
  permissionDenied,
  failed,
  loading,
}: {
  daily?: DailyConsumptionResponse[];
  billing?: { currentCycle?: ConsumptionCycle; orgLimit?: DevinAcuLimit };
  permissionDenied: boolean;
  failed: boolean;
  loading: boolean;
}) {
  const { tokens } = useTheme();
  const cycle = billing?.currentCycle;
  const limit = billing?.orgLimit?.cycle_acu_limit;
  const used = cycleConsumption(daily, cycle);
  const remaining = limit === undefined || used === undefined ? undefined : Math.max(0, limit - used);
  return (
    <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-4 mb-4">
      <View className="flex-row items-center mb-3">
        <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
          <Ionicons name="card-outline" size={15} color={tokens.brandText.hex} />
        </View>
        <View className="flex-1">
          <Text className="text-text-hi text-text14">Current cycle & limits</Text>
          <Text className="text-text-low text-text12 mt-0.5">Read directly from Devin when billing access is available.</Text>
        </View>
      </View>

      {cycle && (
        <StatGrid
          items={[
            { label: 'Cycle usage', value: used === undefined ? 'Unavailable' : `${formatAcu(used)} ACU` },
            { label: 'Organization limit', value: limit === undefined ? 'No cap set' : `${formatAcu(limit)} ACU` },
            { label: 'Cycle starts', value: dateFromUnix(cycle.after) },
            {
              label: 'Remaining',
              value:
                limit === undefined
                  ? 'Unlimited'
                  : remaining === undefined
                    ? 'Unavailable'
                    : `${formatAcu(remaining)} ACU`,
            },
          ]}
        />
      )}

      {!cycle && permissionDenied && (
        <Text className="text-text-mid text-text13 mb-3">
          The connected service user does not have enterprise ManageBilling access. Your in-app activity analytics remain available above.
        </Text>
      )}
      {!cycle && failed && !permissionDenied && (
        <Text className="text-text-mid text-text13 mb-3">Current billing-cycle details could not be loaded.</Text>
      )}
      {!cycle && loading && (
        <View className="flex-row items-center mb-3">
          <ActivityIndicator size="small" color={tokens.brand.hex} />
          <Text className="text-text-mid text-text13 ml-2">Loading billing-cycle details…</Text>
        </View>
      )}
      {!cycle && !loading && !failed && (
        <Text className="text-text-mid text-text13 mb-3">No active enterprise billing cycle was returned for this account.</Text>
      )}

      <Text className="text-text-low text-text12 mb-3">
        The connected Devin v3 credential does not expose self-serve daily/weekly allowance or on-demand credit balance.
      </Text>
      <Pressable
        className="flex-row items-center border-t border-border-subtle pt-3"
        onPress={() => {
          WebBrowser.openBrowserAsync('https://app.devin.ai/settings/usage-limits').catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel="Manage billing on Devin web"
      >
        <Text className="text-brand-text text-text13 flex-1">Manage billing on Devin web</Text>
        <Ionicons name="open-outline" size={15} color={tokens.brandText.hex} />
      </Pressable>
    </View>
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
