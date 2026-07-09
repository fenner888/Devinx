/**
 * Security — Devin code-scan findings (v3 enterprise code-scans API).
 * Lists findings with severity/status; tap to expand and launch a
 * remediation session. The API is enterprise-scoped, so org-level keys
 * get a clear explanation instead of an opaque error.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCodeScanFindings, useRemediateFinding } from '@api/devin/queries';
import { ApiError } from '@api/devin/client';
import { EmptyState } from '@components/Skeletons';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import { useTheme } from '@theme/index';
import type { CodeScanFinding, FindingSeverity } from '@api/devin/types';

const SEVERITY_STYLE: Record<FindingSeverity, { text: string; bg: string }> = {
  critical: { text: 'text-failed', bg: 'bg-tint-red' },
  high: { text: 'text-failed', bg: 'bg-tint-red' },
  medium: { text: 'text-blocked', bg: 'bg-tint-orange' },
  low: { text: 'text-text-mid', bg: 'bg-tint-secondary' },
};

export default function SecurityScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { data: findings, isLoading, error, refetch, isRefetching } = useCodeScanFindings();
  const remediate = useRemediateFinding();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const isPermissionError =
    error instanceof ApiError && (error.code === 'permission' || error.code === 'not_found');

  function handleRemediate(finding: CodeScanFinding) {
    if (remediate.isPending) return;
    hapticLight();
    setActionNote(null);
    remediate.mutate(
      { scanId: finding.scan_id, findingId: finding.finding_id },
      {
        onSuccess: () => {
          hapticSuccess();
          setActionNote(`Remediation session launched for "${finding.title}" — it will open a PR when done.`);
        },
        onError: (e) => {
          hapticError();
          const msg = e instanceof Error ? e.message : 'Could not launch remediation.';
          setActionNote(/409|conflict/i.test(msg)
            ? 'This finding already has a remediation session.'
            : msg);
        },
      },
    );
  }

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
        <Text className="text-text-hi text-text17">Security</Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {isPermissionError && (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-12 h-12 rounded-full bg-tint-secondary items-center justify-center mb-4">
            <Ionicons name="shield-outline" size={22} color={tokens.textMid.hex} />
          </View>
          <Text className="text-text-hi text-text14 text-center mb-2">Enterprise access required</Text>
          <Text className="text-text-mid text-text13 text-center">
            Code-scan findings are only exposed through Devin's enterprise API. This
            service user doesn't have enterprise-level access, so there's nothing to
            show here yet.
          </Text>
        </View>
      )}

      {error && !isPermissionError && !findings && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-failed text-text14 mb-2">Could not load findings</Text>
          <Text className="text-text-mid text-text13 text-center mb-4">{error.message}</Text>
          <Pressable
            className="bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={() => refetch()}
          >
            <Text className="text-brand-text text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !error && findings && findings.length === 0 && (
        <EmptyState
          icon=">_"
          title="No findings"
          message="No open code-scan findings — either scans haven't run yet or everything is clean."
        />
      )}

      {findings && findings.length > 0 && (
        <ScrollView
          className="flex-1 px-4 py-3"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {actionNote && (
            <View className="flex-row items-start bg-tint-blue rounded-card px-3 py-2 mb-3">
              <Ionicons name="information-circle-outline" size={13} color={tokens.brandText.hex} />
              <Text className="text-brand-text text-text12 ml-2 flex-1">{actionNote}</Text>
            </View>
          )}
          {findings?.map((f) => {
            const expanded = expandedId === f.finding_id;
            const sev = SEVERITY_STYLE[f.severity];
            return (
              <Pressable
                key={f.finding_id}
                className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-3"
                onPress={() => setExpandedId(expanded ? null : f.finding_id)}
              >
                <View className="flex-row items-center mb-1">
                  <View className={`rounded-chip px-2 py-0.5 mr-2 ${sev.bg}`}>
                    <Text className={`text-text11 font-medium ${sev.text}`}>{f.severity}</Text>
                  </View>
                  <Text className="text-text-hi text-text13 font-medium flex-1" numberOfLines={expanded ? undefined : 1}>
                    {f.title ?? 'Untitled finding'}
                  </Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={tokens.textLow.hex} />
                </View>
                <View className="flex-row items-center">
                  <Text className="text-text-low text-text12 flex-1" numberOfLines={1}>
                    {f.repo_name}{f.category ? ` · ${f.category}` : ''}
                  </Text>
                  <Text className={`text-text12 capitalize ${f.status === 'open' ? 'text-blocked' : 'text-text-low'}`}>
                    {f.status}
                  </Text>
                </View>
                {expanded && (
                  <View className="mt-3 border-t border-border-subtle pt-3">
                    {f.description && (
                      <Text className="text-text-mid text-text13 mb-2">{f.description}</Text>
                    )}
                    {f.recommendation && (
                      <>
                        <Text className="text-text-low text-text12 font-medium uppercase mb-1">Recommendation</Text>
                        <Text className="text-text-mid text-text13 mb-3">{f.recommendation}</Text>
                      </>
                    )}
                    {f.status === 'open' && !f.session_id && (
                      <Pressable
                        className="flex-row items-center justify-center bg-brand rounded-button py-2.5"
                        disabled={remediate.isPending}
                        onPress={() => handleRemediate(f)}
                      >
                        {remediate.isPending ? (
                          <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                        ) : (
                          <>
                            <Ionicons name="build-outline" size={14} color={tokens.textAlwaysWhite.hex} />
                            <Text className="text-text-always-white text-text13 font-medium ml-2">
                              Remediate with Devin
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                    {f.session_id && (
                      <Pressable
                        className="flex-row items-center justify-center bg-tint-secondary rounded-button py-2.5"
                        onPress={() => router.push(`/(main)/session/${f.session_id}`)}
                      >
                        <Text className="text-brand-text text-text13 font-medium">Open remediation session</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
