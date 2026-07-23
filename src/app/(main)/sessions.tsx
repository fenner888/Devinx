/**
 * Sessions — the full session list.
 * Search, tag filter, sectioned by status, long-press for context actions.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  SectionList,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import { useSessions, useArchiveSession, useTerminateSession } from '@api/devin/queries';
import { useComputerSessions, type ComputerSessionListItem } from '@api/bridge/queries';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import {
  ComputerDiscoveryNotices,
  ComputerSessionRow,
} from '@components/sessions/ComputerSessionRow';
import { useConnections } from '@auth/ConnectionContext';
import { hapticLight, hapticMedium, hapticWarning } from '@lib/haptics';
import { confirmAction } from '@lib/confirm';
import {
  deriveStatusKey,
  statusColorClass,
  statusDotClass,
  statusLabel,
  relativeTime,
  prNumber,
  sectionSessions,
  sectionTitles,
  filterBySearch,
  filterByTags,
  collectTags,
  type SectionKey,
} from '@lib/session-utils';
import { connectionModeUsesCloud, connectionModeUsesComputer } from '@lib/connections';
import type { SessionResponse } from '@api/devin/types';
import { useAppPreferences } from '@store/preferences';
import { userFacingError } from '@lib/user-facing-error';

type ContextAction = 'open' | 'pin' | 'share_link' | 'archive' | 'terminate';

type BoardRow =
  | { kind: 'cloud'; session: SessionResponse }
  | { kind: 'computer'; session: ComputerSessionListItem };

interface BoardSection {
  section: SectionKey | 'computer';
  data: BoardRow[];
}

export default function SessionsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const cloudQuery = useSessions('board');
  const computerQuery = useComputerSessions();
  const { mode } = useConnections();
  const usesCloud = connectionModeUsesCloud(mode);
  const usesComputer = connectionModeUsesComputer(mode);
  const archiveMutation = useArchiveSession();
  const terminateMutation = useTerminateSession();
  const pinnedSessionIds = useAppPreferences((state) => state.pinnedSessionIds);
  const togglePin = useAppPreferences((state) => state.togglePin);

  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [contextSession, setContextSession] = useState<SessionResponse | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const filteredCloud = useMemo(() => {
    if (!cloudQuery.data || !usesCloud) return [];
    return filterByTags(filterBySearch(cloudQuery.data, search), selectedTags);
  }, [cloudQuery.data, search, selectedTags, usesCloud]);

  const filteredComputer = useMemo(() => {
    if (!usesComputer || (usesCloud && selectedTags.length > 0)) return [];
    const query = search.trim().toLowerCase();
    const sessions = computerQuery.data?.sessions ?? [];
    if (!query) return sessions;
    return sessions.filter(
      (session) =>
        session.workspaceName.toLowerCase().includes(query) ||
        (session.title ?? '').toLowerCase().includes(query) ||
        session.computerName.toLowerCase().includes(query),
    );
  }, [computerQuery.data?.sessions, search, selectedTags.length, usesCloud, usesComputer]);

  const sections = useMemo<BoardSection[]>(() => {
    const computerSections: BoardSection[] =
      filteredComputer.length > 0
        ? [
            {
              section: 'computer',
              data: filteredComputer.map((session) => ({ kind: 'computer' as const, session })),
            },
          ]
        : [];
    const cloudSections: BoardSection[] = sectionSessions(filteredCloud, pinnedSessionIds).map(
      (section) => ({
        section: section.section,
        data: section.data.map((session) => ({ kind: 'cloud' as const, session })),
      }),
    );
    return [...computerSections, ...cloudSections];
  }, [filteredCloud, filteredComputer, pinnedSessionIds]);
  const allTags = useMemo(
    () => (usesCloud && cloudQuery.data ? collectTags(cloudQuery.data) : []),
    [cloudQuery.data, usesCloud],
  );
  const isLoading =
    (usesCloud && cloudQuery.isLoading) || (usesComputer && computerQuery.isLoading);
  const isRefetching =
    (usesCloud && cloudQuery.isRefetching) || (usesComputer && computerQuery.isRefetching);
  const hasUnfilteredSessions =
    (usesCloud && (cloudQuery.data?.length ?? 0) > 0) ||
    (usesComputer && (computerQuery.data?.sessions.length ?? 0) > 0);

  const refreshAll = useCallback(() => {
    const refreshes: Promise<unknown>[] = [];
    if (usesCloud) refreshes.push(cloudQuery.refetch());
    if (usesComputer) refreshes.push(computerQuery.refetch());
    Promise.all(refreshes).catch(() => {});
  }, [cloudQuery, computerQuery, usesCloud, usesComputer]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  function handleContextAction(action: ContextAction) {
    const s = contextSession;
    if (!s) return;
    if (action !== 'archive' && action !== 'terminate') setContextSession(null);
    switch (action) {
      case 'open':
        hapticLight();
        router.push(`/(main)/session/${s.session_id}`);
        break;
      case 'pin':
        hapticLight();
        togglePin(s.session_id);
        break;
      case 'share_link':
        hapticLight();
        Share.share({ message: `devinx://session/${s.session_id}` }).catch(() => {});
        break;
      case 'archive':
        hapticWarning();
        setActionNote(null);
        confirmAction(
          {
            title: 'Archive session?',
            message:
              'Removes it from your board (Devin has no permanent delete). You can unarchive it from the Devin web app.',
            confirmLabel: 'Archive',
          },
          () => {
            setContextSession(null);
            archiveMutation.mutate(s.session_id, {
              onError: (e) =>
                setActionNote(userFacingError(e, `Could not archive "${s.title || 'session'}".`)),
            });
          },
          () => setContextSession(null),
        );
        break;
      case 'terminate':
        hapticWarning();
        setActionNote(null);
        confirmAction(
          {
            title: 'Terminate session?',
            message: 'This will stop the session immediately. This action cannot be undone.',
            confirmLabel: 'Terminate',
            destructive: true,
          },
          () => {
            setContextSession(null);
            terminateMutation.mutate(s.session_id, {
              onError: (e) =>
                setActionNote(userFacingError(e, `Could not terminate "${s.title || 'session'}".`)),
            });
          },
          () => setContextSession(null),
        );
        break;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text20 flex-1">Sessions</Text>
        {usesCloud && (
          <Pressable
            className={`rounded-full px-3.5 py-2 ${selectedTags.length > 0 ? 'bg-brand' : 'bg-tint-secondary'}`}
            onPress={() => setShowTagFilter(true)}
          >
            <Text
              className={`text-text13 font-medium ${selectedTags.length > 0 ? 'text-text-always-white' : 'text-text-mid'}`}
            >
              Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
            </Text>
          </Pressable>
        )}
      </View>

      {actionNote && (
        <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mx-5 mb-2">
          <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
          <Text className="text-failed text-text12 ml-2 flex-1">{actionNote}</Text>
        </View>
      )}

      {/* Search */}
      <View className="px-5 pb-2">
        <View className="flex-row items-center bg-surface1 rounded-input px-4 py-2.5 border border-border-subtle">
          <Ionicons name="search-outline" size={16} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search sessions…"
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Active tags */}
      {usesCloud && selectedTags.length > 0 && (
        <View className="px-5 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedTags.map((tag) => (
              <Pressable
                key={tag}
                className="bg-tint-primary rounded-chip px-pillX py-pillY mr-2 flex-row items-center"
                onPress={() => toggleTag(tag)}
              >
                <Text className="text-brand-text text-text12 mr-1">{tag}</Text>
                <Ionicons name="close" size={11} color={tokens.brandText.hex} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {isLoading && <BoardSkeleton />}
      {!isLoading && usesCloud && !usesComputer && cloudQuery.error && sections.length === 0 && (
        <ErrorState
          title="Could not load sessions"
          message={userFacingError(cloudQuery.error, 'Sessions are unavailable right now.')}
          onRetry={refreshAll}
        />
      )}
      {!isLoading &&
        !(usesCloud && !usesComputer && cloudQuery.error && sections.length === 0) &&
        sections.length === 0 && (
          <View className="flex-1 px-5">
            <ComputerDiscoveryNotices computers={computerQuery.data?.computers ?? []} />
            {usesCloud && usesComputer && cloudQuery.error && (
              <View className="rounded-card border border-border-subtle bg-surface1 px-3 py-2.5 mb-2">
                <Text className="text-text-mid text-text12">
                  Devin Cloud sessions could not be refreshed.
                </Text>
              </View>
            )}
            <EmptyState
              icon=">_"
              title={hasUnfilteredSessions ? 'No matches' : 'No sessions yet'}
              message={
                hasUnfilteredSessions
                  ? 'No sessions match your search or tag filters.'
                  : usesComputer && !usesCloud
                    ? 'Start or resume a session on your paired local device.'
                    : 'Start a new session from Home.'
              }
            />
          </View>
        )}

      {sections.length > 0 && (
        <SectionList<BoardRow, BoardSection>
          className="flex-1 px-5"
          contentContainerClassName="pb-6"
          sections={sections}
          keyExtractor={(item) =>
            item.kind === 'cloud'
              ? `cloud:${item.session.session_id}`
              : `computer:${item.session.bridgeId}:${item.session.id}`
          }
          ListHeaderComponent={
            <View>
              <ComputerDiscoveryNotices computers={computerQuery.data?.computers ?? []} />
              {usesCloud && cloudQuery.error && (
                <View className="rounded-card border border-border-subtle bg-surface1 px-3 py-2.5 mb-2">
                  <Text className="text-text-mid text-text12">
                    Devin Cloud sessions could not be refreshed.
                  </Text>
                </View>
              )}
            </View>
          }
          renderSectionHeader={({ section: boardSection }) => (
            <View className="py-2 bg-surface0">
              <Text className="text-text-low text-text12 font-medium uppercase tracking-wider">
                {boardSection.section === 'computer'
                  ? 'Local'
                  : sectionTitles[boardSection.section]}{' '}
                ({boardSection.data.length})
              </Text>
            </View>
          )}
          renderItem={({ item }) =>
            item.kind === 'computer' ? (
              <ComputerSessionRow
                session={item.session}
                onPress={
                  item.session.canLoad
                    ? () =>
                        router.push({
                          pathname: '/(main)/computer-session/[bridgeId]/[id]',
                          params: {
                            bridgeId: item.session.bridgeId,
                            id: item.session.id,
                          },
                        })
                    : undefined
                }
              />
            ) : (
              <SessionRow
                session={item.session}
                pinned={pinnedSessionIds.includes(item.session.session_id)}
                onPress={() => router.push(`/(main)/session/${item.session.session_id}`)}
                onLongPress={() => setContextSession(item.session)}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refreshAll}
              tintColor={tokens.brand.hex}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Tag filter */}
      <Modal
        statusBarTranslucent
        visible={showTagFilter}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTagFilter(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[60%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Filter by tags</Text>
              <Pressable onPress={() => setShowTagFilter(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            {allTags.length === 0 ? (
              <Text className="text-text-mid text-text14 text-center py-8">No tags found</Text>
            ) : (
              <ScrollView>
                <View className="flex-row flex-wrap">
                  {allTags.map(({ tag }) => (
                    <Pressable
                      key={tag}
                      className={`rounded-chip px-pillX py-pillY mr-2 mb-2 ${selectedTags.includes(tag) ? 'bg-brand' : 'bg-tint-secondary'}`}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        className={`text-text13 ${selectedTags.includes(tag) ? 'text-text-always-white' : 'text-text-mid'}`}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
            {selectedTags.length > 0 && (
              <Pressable className="mt-4 py-2" onPress={() => setSelectedTags([])}>
                <Text className="text-text-mid text-text14 text-center">Clear all filters</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Context menu */}
      <Modal
        statusBarTranslucent
        visible={!!contextSession}
        animationType="fade"
        transparent
        onRequestClose={() => setContextSession(null)}
      >
        <Pressable
          className="flex-1 bg-scrim justify-center items-center"
          onPress={() => setContextSession(null)}
        >
          <View className="bg-surface2 rounded-cardLg px-2 py-2 w-64 border border-border">
            {(
              [
                {
                  action: 'open',
                  icon: 'open-outline',
                  label: 'Open session',
                  color: tokens.textHi.hex,
                  cls: 'text-text-hi',
                },
                {
                  action: 'pin',
                  icon: pinnedSessionIds.includes(contextSession?.session_id ?? '')
                    ? 'pin-outline'
                    : 'pin',
                  label: pinnedSessionIds.includes(contextSession?.session_id ?? '')
                    ? 'Unpin session'
                    : 'Pin session',
                  color: tokens.textHi.hex,
                  cls: 'text-text-hi',
                },
                {
                  action: 'share_link',
                  icon: 'share-outline',
                  label: 'Share deep link',
                  color: tokens.textHi.hex,
                  cls: 'text-text-hi',
                },
                {
                  action: 'archive',
                  icon: 'archive-outline',
                  label: 'Archive (remove from board)',
                  color: tokens.textMid.hex,
                  cls: 'text-text-mid',
                },
                {
                  action: 'terminate',
                  icon: 'stop-circle-outline',
                  label: 'Terminate',
                  color: tokens.failed.hex,
                  cls: 'text-failed',
                },
              ] as {
                action: ContextAction;
                icon: keyof typeof Ionicons.glyphMap;
                label: string;
                color: string;
                cls: string;
              }[]
            ).map(({ action, icon, label, color, cls }) => (
              <Pressable
                key={action}
                className="flex-row items-center px-4 py-3 rounded-button"
                onPress={() => handleContextAction(action)}
              >
                <Ionicons name={icon} size={16} color={color} />
                <Text className={`text-text14 ml-3 ${cls}`}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SessionRow({
  session,
  pinned,
  onPress,
  onLongPress,
}: {
  session: SessionResponse;
  pinned: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const key = deriveStatusKey(session);
  const { tokens } = useTheme();
  return (
    <Pressable
      className="flex-row items-center bg-surface1 rounded-card border border-border-subtle px-4 py-3.5 mb-2"
      onPress={onPress}
      onLongPress={() => {
        hapticMedium();
        onLongPress();
      }}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${session.title || 'Untitled session'}, ${statusLabel(session)}`}
      accessibilityHint="Double tap to open. Long press for more options."
    >
      <View className={`w-2 h-2 rounded-full mr-3 ${statusDotClass(key)}`} />
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={1}>
          {session.title || 'Untitled session'}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className={`text-text13 ${statusColorClass(key)}`}>{statusLabel(session)}</Text>
          <Text className="text-text-low text-text12 ml-2">{relativeTime(session.updated_at)}</Text>
        </View>
      </View>
      {pinned && <Ionicons name="pin" size={13} color={tokens.brandText.hex} />}
      {session.pull_requests[0] && (
        <View className="bg-tint-purple rounded-chip px-2 py-0.5 ml-2">
          <Text className="text-merged text-text12">
            #{prNumber(session.pull_requests[0].pr_url)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
