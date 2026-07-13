import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreateSession, useRepositories, useSessions } from '@api/devin/queries';
import type { RepositoryResponse, SessionResponse } from '@api/devin/types';
import { useConnections } from '@auth/ConnectionContext';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import { connectionModeUsesCloud } from '@lib/connections';
import { hapticError, hapticLight, hapticSuccess } from '@lib/haptics';
import { relativeTime, statusLabel } from '@lib/session-utils';
import {
  groupSecurityWork,
  SECURITY_REVIEW_TAG,
  SECURITY_WORK_TAG,
  securityReviewPrompt,
} from '@lib/security-work';
import { rememberSessionRepository } from '@lib/session-repository';
import { useTheme } from '@theme/index';

const MAXIMUM_FOCUS_LENGTH = 1_000;

export default function SecurityWorkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { mode } = useConnections();
  const cloudEnabled = connectionModeUsesCloud(mode);
  const sessions = useSessions('board');
  const repositories = useRepositories();
  const createSession = useCreateSession();
  const [showStart, setShowStart] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState<RepositoryResponse | null>(null);
  const [focus, setFocus] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
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

  function closeStart() {
    if (createSession.isPending) return;
    setShowStart(false);
    setSelectedRepository(null);
    setFocus('');
    setCreateError(null);
  }

  async function startReview() {
    if (!selectedRepository || createSession.isPending) return;
    setCreateError(null);
    try {
      const session = await createSession.mutateAsync({
        prompt: securityReviewPrompt(selectedRepository.repo_path, focus),
        title: `Security review: ${selectedRepository.repo_name}`,
        repos: [selectedRepository.repo_path],
        tags: [SECURITY_WORK_TAG, SECURITY_REVIEW_TAG],
        devin_mode: 'normal',
      });
      await rememberSessionRepository(session.session_id, selectedRepository.repo_path);
      hapticSuccess();
      closeStart();
      router.replace(`/(main)/session/${session.session_id}`);
    } catch (error) {
      hapticError();
      setCreateError(error instanceof Error ? error.message : 'The security review could not start.');
    }
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
          <Text className="mt-0.5 text-text-low text-text12">Session-based reviews and agents</Text>
        </View>
        {cloudEnabled && (
          <Pressable
            className="h-10 flex-row items-center rounded-full bg-brand px-3.5"
            onPress={() => {
              hapticLight();
              setShowStart(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Start security review"
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={tokens.textAlwaysWhite.hex} />
            <Text className="ml-1.5 text-text-always-white text-text13 font-medium">New review</Text>
          </Pressable>
        )}
      </View>

      <View className="mx-5 mb-3 rounded-card border border-border-subtle bg-surface1 px-4 py-3">
        <Text className="text-text-hi text-text14 font-medium">Security reviews you can inspect and steer</Text>
        <Text className="mt-1 text-text-mid text-text12">
          DevinX groups supported security-category sessions with their child agents. This is
          session work, not the enterprise Code Scan findings dashboard.
        </Text>
      </View>

      {!cloudEnabled ? (
        <View className="flex-1 px-5">
          <EmptyState
            icon="shield"
            title="Connect Devin Cloud"
            message="Security Work uses your Devin Cloud sessions and repositories."
          />
        </View>
      ) : sessions.isLoading ? (
        <BoardSkeleton />
      ) : sessions.error && groups.length === 0 ? (
        <ErrorState
          title="Could not load security work"
          message={sessions.error.message}
          onRetry={() => sessions.refetch()}
        />
      ) : groups.length === 0 ? (
        <View className="flex-1 px-5">
          <EmptyState
            icon="shield"
            title="No security work yet"
            message="Start a review here, or run a security-category session in Devin."
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
                  accessibilityLabel={`Open ${group.root.title ?? 'security review'}`}
                >
                  <View className="flex-row items-start">
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-button bg-tint-blue">
                      <Ionicons name="shield-checkmark-outline" size={18} color={tokens.brandText.hex} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-text-hi text-text15 font-medium" numberOfLines={2}>
                        {group.root.title ?? 'Security review'}
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
                        {group.workers.length} child {group.workers.length === 1 ? 'agent' : 'agents'}
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
                          <Ionicons name="git-branch-outline" size={15} color={tokens.textLow.hex} />
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

      <Modal
        visible={showStart}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={closeStart}
      >
        <View className="flex-1 justify-end bg-scrim">
          <View
            className="max-h-[82%] rounded-t-sheet bg-surface2 px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center">
              <View className="flex-1">
                <Text className="text-text-hi text-text18">Start security review</Text>
                <Text className="mt-1 text-text-low text-text12">
                  Read-only first pass using ordinary Devin sessions and child agents.
                </Text>
              </View>
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-tint-secondary"
                onPress={closeStart}
                accessibilityRole="button"
                accessibilityLabel="Close security review"
              >
                <Ionicons name="close" size={18} color={tokens.textMid.hex} />
              </Pressable>
            </View>

            <Text className="mb-2 text-text-mid text-text12 font-medium uppercase">Repository</Text>
            <ScrollView className="max-h-64" nestedScrollEnabled>
              {(repositories.data ?? []).map((repository) => {
                const selected = selectedRepository?.repo_path === repository.repo_path;
                return (
                  <Pressable
                    key={repository.provider_repository_id}
                    className={`mb-2 flex-row items-center rounded-card border px-3 py-3 ${selected ? 'border-brand bg-tint-blue' : 'border-border-subtle bg-surface1'}`}
                    onPress={() => setSelectedRepository(repository)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Review ${repository.repo_name}`}
                  >
                    <Ionicons name="folder-outline" size={17} color={tokens.textMid.hex} />
                    <View className="ml-3 min-w-0 flex-1">
                      <Text className="text-text-hi text-text14" numberOfLines={1}>
                        {repository.repo_name}
                      </Text>
                      <Text className="mt-0.5 text-text-low text-text11" numberOfLines={1}>
                        {repository.repo_path}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={19} color={tokens.brandText.hex} />}
                  </Pressable>
                );
              })}
              {!repositories.isLoading && (repositories.data?.length ?? 0) === 0 && (
                <Text className="py-5 text-center text-text-mid text-text13">
                  No Devin Cloud repositories are available.
                </Text>
              )}
            </ScrollView>

            <Text className="mb-2 mt-3 text-text-mid text-text12 font-medium uppercase">
              Additional focus (optional)
            </Text>
            <TextInput
              className="min-h-24 rounded-input border border-border-subtle bg-surface1 px-3 py-3 text-text-hi text-text14"
              value={focus}
              onChangeText={(value) => setFocus(value.slice(0, MAXIMUM_FOCUS_LENGTH))}
              placeholder="Example: concentrate on authentication and cross-tenant access"
              placeholderTextColor={tokens.textLow.hex}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Security review focus"
            />

            {createError && (
              <View className="mt-3 rounded-card bg-tint-red px-3 py-2.5">
                <Text className="text-failed text-text12">{createError}</Text>
              </View>
            )}

            <Pressable
              className={`mt-4 h-12 flex-row items-center justify-center rounded-button ${selectedRepository && !createSession.isPending ? 'bg-brand' : 'bg-tint-secondary'}`}
              onPress={startReview}
              disabled={!selectedRepository || createSession.isPending}
              accessibilityRole="button"
              accessibilityLabel="Start read-only security review"
            >
              {createSession.isPending ? (
                <ActivityIndicator size="small" color={tokens.textMid.hex} />
              ) : (
                <>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color={selectedRepository ? tokens.textAlwaysWhite.hex : tokens.textLow.hex}
                  />
                  <Text
                    className={`ml-2 text-text14 font-medium ${selectedRepository ? 'text-text-always-white' : 'text-text-low'}`}
                  >
                    Start read-only review
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
