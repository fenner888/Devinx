import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useCodeScanFindings,
  useCodeScanMetrics,
  useRemediateFinding,
} from '@api/devin/queries';
import { ApiError } from '@api/devin/client';
import { hapticError, hapticLight, hapticSuccess } from '@lib/haptics';
import {
  filterCodeScanFindings,
  groupCodeScanFindings,
  type CodeScanSummary,
  type FindingSeverityFilter,
} from '@lib/code-scans';
import { useTheme } from '@theme/index';
import type { CodeScanFinding, CodeScanMetrics, FindingSeverity } from '@api/devin/types';

const DEVIN_SECURITY_URL = 'https://app.devin.ai/';
const SEVERITY_FILTERS: FindingSeverityFilter[] = ['all', 'critical', 'high', 'medium', 'low'];
const SEVERITY_STYLE: Record<FindingSeverity, { text: string; bg: string }> = {
  critical: { text: 'text-failed', bg: 'bg-tint-red' },
  high: { text: 'text-failed', bg: 'bg-tint-red' },
  medium: { text: 'text-blocked', bg: 'bg-tint-orange' },
  low: { text: 'text-text-mid', bg: 'bg-tint-secondary' },
};

type SecurityTab = 'overview' | 'findings';

function formatScanDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(unixSeconds * 1000),
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 rounded-card border border-border-subtle bg-surface1 px-3 py-3">
      <Text className="text-text-hi text-text20 font-semibold">{value}</Text>
      <Text className="mt-1 text-text-low text-text11">{label}</Text>
    </View>
  );
}

function MetricsGrid({ metrics }: { metrics: CodeScanMetrics | undefined }) {
  const urgent = metrics
    ? metrics.open_critical_findings_count + metrics.open_high_findings_count
    : '—';
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <MetricCard label="Scans · 30 days" value={metrics?.scans_count ?? '—'} />
        <MetricCard label="Repositories" value={metrics?.repos_scanned_count ?? '—'} />
      </View>
      <View className="flex-row gap-2">
        <MetricCard label="Critical + high open" value={urgent} />
        <MetricCard label="Remediation PRs merged" value={metrics?.prs_merged_count ?? '—'} />
      </View>
    </View>
  );
}

function ScanCard({ scan, onPress }: { scan: CodeScanSummary; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      className="mb-2 rounded-card border border-border-subtle bg-surface1 px-4 py-3"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${scan.repoName} scan findings`}
    >
      <View className="flex-row items-start">
        <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-tint-blue">
          <Ionicons name="shield-checkmark-outline" size={18} color={tokens.brandText.hex} />
        </View>
        <View className="flex-1">
          <Text className="text-text-hi text-text14 font-medium" numberOfLines={1}>
            {scan.repoName}
          </Text>
          <Text className="mt-0.5 text-text-low text-text11">
            {formatScanDate(scan.createdAt)} · {scan.openCount} open of {scan.findingsCount}
          </Text>
          <View className="mt-2 flex-row gap-2">
            {scan.criticalCount > 0 && (
              <Text className="text-failed text-text11">{scan.criticalCount} critical</Text>
            )}
            {scan.highCount > 0 && (
              <Text className="text-failed text-text11">{scan.highCount} high</Text>
            )}
            {scan.criticalCount === 0 && scan.highCount === 0 && (
              <Text className="text-success text-text11">No critical or high findings</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
      </View>
    </Pressable>
  );
}

interface FindingCardProps {
  finding: CodeScanFinding;
  expanded: boolean;
  remediationPending: boolean;
  onToggle: () => void;
  onRemediate: () => void;
  onOpenSession: (sessionId: string) => void;
}

function FindingCard({
  finding,
  expanded,
  remediationPending,
  onToggle,
  onRemediate,
  onOpenSession,
}: FindingCardProps) {
  const { tokens } = useTheme();
  const severity = SEVERITY_STYLE[finding.severity];
  return (
    <Pressable
      className="mb-3 rounded-card border border-border-subtle bg-surface1 px-4 py-3"
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${finding.severity} finding, ${finding.title ?? 'Untitled finding'}`}
    >
      <View className="flex-row items-center">
        <View className={`mr-2 rounded-chip px-2 py-0.5 ${severity.bg}`}>
          <Text className={`text-text11 font-medium capitalize ${severity.text}`}>
            {finding.severity}
          </Text>
        </View>
        <Text className="flex-1 text-text-hi text-text13 font-medium" numberOfLines={expanded ? undefined : 1}>
          {finding.title ?? 'Untitled finding'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={tokens.textLow.hex}
        />
      </View>
      <View className="mt-1 flex-row items-center">
        <Text className="flex-1 text-text-low text-text11" numberOfLines={1}>
          {finding.repo_name}
          {finding.category ? ` · ${finding.category}` : ''}
        </Text>
        <Text className={finding.status === 'open' ? 'text-blocked text-text11' : 'text-text-low text-text11'}>
          {finding.status}
        </Text>
      </View>
      {expanded && (
        <View className="mt-3 border-t border-border-subtle pt-3">
          {finding.description && (
            <Text className="mb-3 text-text-mid text-text13 leading-5">{finding.description}</Text>
          )}
          {finding.recommendation && (
            <View className="mb-3 rounded-card bg-surface2 px-3 py-3">
              <Text className="mb-1 text-text-low text-text11 font-medium uppercase">Recommendation</Text>
              <Text className="text-text-mid text-text13 leading-5">{finding.recommendation}</Text>
            </View>
          )}
          {finding.status === 'open' && !finding.session_id && (
            <Pressable
              className="flex-row items-center justify-center rounded-button bg-brand py-2.5"
              disabled={remediationPending}
              onPress={(event) => {
                event.stopPropagation();
                onRemediate();
              }}
              accessibilityRole="button"
              accessibilityLabel="Remediate finding with Devin"
            >
              {remediationPending ? (
                <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
              ) : (
                <>
                  <Ionicons name="build-outline" size={14} color={tokens.textAlwaysWhite.hex} />
                  <Text className="ml-2 text-text-always-white text-text13 font-medium">
                    Remediate with Devin
                  </Text>
                </>
              )}
            </Pressable>
          )}
          {finding.session_id && (
            <Pressable
              className="items-center rounded-button bg-tint-secondary py-2.5"
              onPress={(event) => {
                event.stopPropagation();
                onOpenSession(finding.session_id as string);
              }}
              accessibilityRole="button"
              accessibilityLabel="Open remediation session"
            >
              <Text className="text-brand-text text-text13 font-medium">Open remediation session</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const findingsQuery = useCodeScanFindings();
  const metricsQuery = useCodeScanMetrics();
  const remediate = useRemediateFinding();
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview');
  const [severity, setSeverity] = useState<FindingSeverityFilter>('all');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const findings = useMemo(() => findingsQuery.data ?? [], [findingsQuery.data]);
  const scans = useMemo(() => groupCodeScanFindings(findings), [findings]);
  const visibleFindings = useMemo(() => {
    const inScan = selectedScanId
      ? findings.filter((finding) => finding.scan_id === selectedScanId)
      : findings;
    return filterCodeScanFindings(inScan, severity);
  }, [findings, selectedScanId, severity]);
  const permissionError = [findingsQuery.error, metricsQuery.error].find(
    (error) =>
      error instanceof ApiError && (error.code === 'permission' || error.code === 'not_found'),
  );
  const refreshing = findingsQuery.isRefetching || metricsQuery.isRefetching;

  function handleRemediate(finding: CodeScanFinding) {
    if (remediate.isPending) return;
    hapticLight();
    setActionNote(null);
    remediate.mutate(
      { scanId: finding.scan_id, findingId: finding.finding_id },
      {
        onSuccess: () => {
          hapticSuccess();
          setActionNote(`Remediation launched for “${finding.title ?? 'this finding'}”.`);
        },
        onError: (error) => {
          hapticError();
          setActionNote(
            /409|conflict/i.test(error.message)
              ? 'This finding already has a remediation session.'
              : 'The remediation session could not be launched.',
          );
        },
      },
    );
  }

  async function openDevinSecurity() {
    hapticLight();
    try {
      await Linking.openURL(DEVIN_SECURITY_URL);
    } catch {
      setActionNote('Devin Security could not be opened on this device.');
    }
  }

  function selectScan(scanId: string) {
    setSelectedScanId(scanId);
    setSeverity('all');
    setActiveTab('findings');
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center border-b border-border-subtle px-4 py-3">
        <Pressable
          className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-tint-secondary"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-text-hi text-text17">Security</Text>
          <Text className="text-text-low text-text11">Security Swarm monitoring and remediation</Text>
        </View>
      </View>

      {permissionError ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-tint-secondary">
            <Ionicons name="shield-outline" size={22} color={tokens.textMid.hex} />
          </View>
          <Text className="mb-2 text-center text-text-hi text-text14">Enterprise access required</Text>
          <Text className="text-center text-text-mid text-text13 leading-5">
            Security Swarm data requires enterprise code-scan permissions for this Devin service user.
          </Text>
        </View>
      ) : findingsQuery.isLoading && metricsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10 pt-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                findingsQuery.refetch();
                metricsQuery.refetch();
              }}
              tintColor={tokens.brand.hex}
            />
          }
        >
          <View className="mb-4 rounded-2xl border border-border-subtle bg-surface1 px-4 py-4">
            <View className="flex-row items-start">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-tint-blue">
                <Ionicons name="shield-checkmark-outline" size={20} color={tokens.brandText.hex} />
              </View>
              <View className="flex-1">
                <Text className="text-text-hi text-text16 font-semibold">Security Swarm</Text>
                <Text className="mt-1 text-text-mid text-text12 leading-4">
                  Track parallel security scans and send verified findings to Devin for remediation.
                </Text>
              </View>
            </View>
            <Pressable
              className="mt-4 flex-row items-center justify-center rounded-button border border-border-subtle bg-surface2 py-2.5"
              onPress={openDevinSecurity}
              accessibilityRole="link"
              accessibilityLabel="Start Security Swarm in Devin"
            >
              <Text className="mr-2 text-brand-text text-text13 font-medium">Start in Devin</Text>
              <Ionicons name="open-outline" size={14} color={tokens.brandText.hex} />
            </Pressable>
            <Text className="mt-2 text-center text-text-low text-text11">
              New scans currently start in Devin; monitoring and remediation stay here.
            </Text>
          </View>

          {actionNote && (
            <View className="mb-4 flex-row items-start rounded-card bg-tint-blue px-3 py-2.5">
              <Ionicons name="information-circle-outline" size={15} color={tokens.brandText.hex} />
              <Text className="ml-2 flex-1 text-brand-text text-text12">{actionNote}</Text>
            </View>
          )}

          <Text className="mb-2 text-text-hi text-text14 font-medium">Last 30 days</Text>
          <MetricsGrid metrics={metricsQuery.data} />
          {metricsQuery.error && !permissionError && (
            <Text className="mt-2 text-text-low text-text11">
              Metrics are temporarily unavailable. Findings can still be reviewed below.
            </Text>
          )}

          <View className="mb-4 mt-5 flex-row rounded-button bg-surface1 p-1">
            {(['overview', 'findings'] as const).map((tab) => {
              const selected = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  className={`flex-1 items-center rounded-button py-2 ${selected ? 'bg-surface2' : ''}`}
                  onPress={() => {
                    setActiveTab(tab);
                    if (tab === 'overview') setSelectedScanId(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Text className={selected ? 'text-text-hi text-text13 font-medium' : 'text-text-mid text-text13'}>
                    {tab === 'overview' ? 'Scans' : 'Findings'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'overview' ? (
            scans.length === 0 ? (
              <View className="items-center rounded-card border border-border-subtle bg-surface1 px-5 py-10">
                <Ionicons name="shield-outline" size={24} color={tokens.textLow.hex} />
                <Text className="mt-3 text-text-hi text-text14">No Security Swarm scans yet</Text>
                <Text className="mt-1 text-center text-text-mid text-text12">
                  Start a scan in Devin, then pull to refresh its results here.
                </Text>
              </View>
            ) : (
              scans.map((scan) => (
                <ScanCard key={scan.scanId} scan={scan} onPress={() => selectScan(scan.scanId)} />
              ))
            )
          ) : (
            <>
              {selectedScanId && (
                <Pressable
                  className="mb-3 flex-row items-center self-start rounded-chip bg-tint-blue px-3 py-1.5"
                  onPress={() => setSelectedScanId(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Show findings from all scans"
                >
                  <Text className="mr-2 text-brand-text text-text11">Selected scan</Text>
                  <Ionicons name="close" size={13} color={tokens.brandText.hex} />
                </Pressable>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerClassName="gap-2"
              >
                {SEVERITY_FILTERS.map((filter) => {
                  const selected = severity === filter;
                  return (
                    <Pressable
                      key={filter}
                      className={`rounded-chip border px-3 py-1.5 ${
                        selected ? 'border-brand bg-tint-blue' : 'border-border-subtle bg-surface1'
                      }`}
                      onPress={() => setSeverity(filter)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text className={selected ? 'text-brand-text text-text11 capitalize' : 'text-text-mid text-text11 capitalize'}>
                        {filter}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {findingsQuery.error && !findingsQuery.data ? (
                <View className="items-center rounded-card border border-border-subtle bg-surface1 px-5 py-8">
                  <Text className="text-failed text-text13">Could not load findings</Text>
                  <Pressable className="mt-3 rounded-button bg-tint-secondary px-4 py-2" onPress={() => findingsQuery.refetch()}>
                    <Text className="text-brand-text text-text13">Try again</Text>
                  </Pressable>
                </View>
              ) : visibleFindings.length === 0 ? (
                <View className="items-center rounded-card border border-border-subtle bg-surface1 px-5 py-8">
                  <Text className="text-text-hi text-text13">No matching findings</Text>
                </View>
              ) : (
                visibleFindings.map((finding) => (
                  <FindingCard
                    key={finding.finding_id}
                    finding={finding}
                    expanded={expandedId === finding.finding_id}
                    remediationPending={remediate.isPending}
                    onToggle={() => setExpandedId(expandedId === finding.finding_id ? null : finding.finding_id)}
                    onRemediate={() => handleRemediate(finding)}
                    onOpenSession={(sessionId) => router.push(`/(main)/session/${sessionId}`)}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
