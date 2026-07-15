import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSessions } from '@api/devin/queries';
import type { SessionResponse } from '@api/devin/types';
import { useConnections } from '@auth/ConnectionContext';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import { connectionModeUsesCloud } from '@lib/connections';
import { hapticLight } from '@lib/haptics';
import { relativeTime, statusLabel } from '@lib/session-utils';
import { groupSecurityWork } from '@lib/security-work';
import { userFacingError } from '@lib/user-facing-error';
import { useTheme } from '@theme/index';

export default function SecurityWorkScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { mode } = useConnections();
  const cloudEnabled = connectionModeUsesCloud(mode);
  const sessions = useSessions('board');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo(
    () => groupSecurityWork(cloudEnabled ? (sessions.data ?? []) : []),
    [cloudEnabled, sessions.data],
  );

  function openSession(session: SessionResponse) {
    hapticLight();
    router.push(`/(main)/session/${session.session_id}`);
  }

  function toggleGroup(sessionId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 pb-3 pt-2">
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full bg-tint-secondary"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-text-hi text-text20">Security Work</Text>
          <Text className="mt-0.5 text-text-low text-text12">Verified Code Scan sessions</Text>
        </View>
      </View>

      <View className="mx-5 mb-3 rounded-card border border-border-subtle bg-surface1 px-4 py-3">
        <Text className="text-text-hi text-text14 font-medium">Genuine Code Scans only</Text>
        <Text className="mt-1 text-text-mid text-text12">
          Only sessions returned by Devin with origin code_scan appear here. Child agents stay
          grouped beneath their scan coordinator.
        </Text>
      </View>

      {!cloudEnabled ? (
        <View className="flex-1 px-5">
          <EmptyState
            icon="shield"
            title="Connect Devin Cloud"
            message="Security Work uses Code Scan sessions returned by Devin Cloud."
          />
        </View>
      ) : sessions.isLoading ? (
        <BoardSkeleton />
      ) : sessions.error && groups.length === 0 ? (
        <ErrorState
          title="Could not load security work"
          message={userFacingError(sessions.error, 'Security Work is unavailable right now.')}
          onRetry={() => sessions.refetch()}
        />
      ) : groups.length === 0 ? (
        <View className="flex-1 px-5">
          <EmptyState
            icon="shield"
            title="No Code Scans yet"
            message="No sessions with the verified code_scan origin were returned for this account."
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-8"
          refreshControl={
            <RefreshControl
              refreshing={sessions.isRefetching}
              onRefresh={() => sessions.refetch()}
              tintColor={tokens.brand.hex}
            />
          }
        >
          {groups.map((group) => {
            const expanded = expandedGroups.has(group.root.session_id);
            const agentCount = group.workers.length + 1;
            return (
              <View
                key={group.root.session_id}
                className="mb-3 overflow-hidden rounded-card border border-border-subtle bg-surface1"
                testID={`security-work-group-${group.root.session_id}`}
              >
                <Pressable
                  className="px-4 py-3.5"
                  onPress={() => openSession(group.root)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${group.root.title ?? 'Code Scan'}`}
                >
                  <View className="flex-row items-start">
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-button bg-tint-blue">
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={18}
                        color={tokens.brandText.hex}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-text-hi text-text15 font-medium" numberOfLines={2}>
                        {group.root.title ?? 'Code Scan'}
                      </Text>
                      <Text className="mt-1 text-text-mid text-text12">
                        {statusLabel(group.root)} · {relativeTime(group.updatedAt)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
                  </View>
                  <View className="mt-3 flex-row items-center">
                    <View className="rounded-chip bg-tint-secondary px-2.5 py-1">
                      <Text className="text-text-mid text-text11">
                        {agentCount} {agentCount === 1 ? 'session' : 'agent sessions'}
                      </Text>
                    </View>
                    {group.root.pull_requests.length > 0 && (
                      <View className="ml-2 rounded-chip bg-tint-purple px-2.5 py-1">
                        <Text className="text-merged text-text11">
                          {group.root.pull_requests.length} PR
                          {group.root.pull_requests.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>

                {group.workers.length > 0 && (
                  <View className="border-t border-border-subtle">
                    <Pressable
                      className="flex-row items-center px-4 py-2.5"
                      onPress={() => toggleGroup(group.root.session_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${expanded ? 'Hide' : 'Show'} child agents`}
                    >
                      <Text className="flex-1 text-text-mid text-text12">
                        {group.workers.length} child{' '}
                        {group.workers.length === 1 ? 'agent' : 'agents'}
                      </Text>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={tokens.textLow.hex}
                      />
                    </Pressable>
                    {expanded &&
                      group.workers.map((worker) => (
                        <Pressable
                          key={worker.session_id}
                          className="flex-row items-center border-t border-border-subtle px-4 py-3"
                          onPress={() => openSession(worker)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open child agent ${worker.title ?? 'session'}`}
                        >
                          <Ionicons
                            name="git-branch-outline"
                            size={15}
                            color={tokens.textLow.hex}
                          />
                          <View className="ml-3 min-w-0 flex-1">
                            <Text className="text-text-hi text-text13" numberOfLines={1}>
                              {worker.title ?? 'Security worker'}
                            </Text>
                            <Text className="mt-0.5 text-text-low text-text11">
                              {statusLabel(worker)} · {relativeTime(worker.updated_at)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color={tokens.textLow.hex} />
                        </Pressable>
                      ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
