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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import { useSessions, useArchiveSession, useTerminateSession } from '@api/devin/queries';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
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
} from '@lib/session-utils';
import type { SessionResponse } from '@api/devin/types';

type ContextAction = 'open' | 'share_link' | 'archive' | 'terminate';

export default function SessionsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { data, isLoading, error, refetch, isRefetching } = useSessions('board');
  const archiveMutation = useArchiveSession();
  const terminateMutation = useTerminateSession();

  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [contextSession, setContextSession] = useState<SessionResponse | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterByTags(filterBySearch(data, search), selectedTags);
  }, [data, search, selectedTags]);

  const sections = useMemo(() => sectionSessions(filtered), [filtered]);
  const allTags = useMemo(() => (data ? collectTags(data) : []), [data]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  function handleContextAction(action: ContextAction) {
    const s = contextSession;
    setContextSession(null);
    if (!s) return;
    switch (action) {
      case 'open':
        hapticLight();
        router.push(`/(main)/session/${s.session_id}`);
        break;
      case 'share_link':
        hapticLight();
        Share.share({ message: `devinx://session/${s.session_id}` }).catch(() => {});
        break;
      case 'archive':
        hapticWarning();
        confirmAction(
          { title: 'Archive session?', message: 'This will archive the session. You can unarchive it from the Devin web app.', confirmLabel: 'Archive' },
          () => archiveMutation.mutate(s.session_id),
        );
        break;
      case 'terminate':
        hapticWarning();
        confirmAction(
          { title: 'Terminate session?', message: 'This will stop the session immediately. This action cannot be undone.', confirmLabel: 'Terminate', destructive: true },
          () => terminateMutation.mutate(s.session_id),
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
        <Pressable
          className={`rounded-full px-3.5 py-2 ${selectedTags.length > 0 ? 'bg-brand' : 'bg-tint-secondary'}`}
          onPress={() => setShowTagFilter(true)}
        >
          <Text className={`text-text13 font-medium ${selectedTags.length > 0 ? 'text-text-always-white' : 'text-text-mid'}`}>
            Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
          </Text>
        </Pressable>
      </View>

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
      {selectedTags.length > 0 && (
        <View className="px-5 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedTags.map((tag) => (
              <Pressable key={tag} className="bg-tint-primary rounded-chip px-pillX py-pillY mr-2 flex-row items-center" onPress={() => toggleTag(tag)}>
                <Text className="text-brand-text text-text12 mr-1">{tag}</Text>
                <Ionicons name="close" size={11} color={tokens.brandText.hex} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {isLoading && <BoardSkeleton />}
      {error && <ErrorState title="Could not load sessions" message={error.message} onRetry={() => refetch()} />}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={data && data.length > 0 ? 'No matches' : 'No sessions yet'}
          message={data && data.length > 0 ? 'No sessions match your search or tag filters.' : 'Start a new session from Home.'}
        />
      )}

      {!error && filtered.length > 0 && (
        <SectionList
          className="flex-1 px-5"
          contentContainerClassName="pb-6"
          sections={sections}
          keyExtractor={(item) => item.session_id}
          renderSectionHeader={({ section: { section } }) => (
            <View className="py-2 bg-surface0">
              <Text className="text-text-low text-text12 font-medium uppercase tracking-wider">
                {sectionTitles[section]} ({sections.find((s) => s.section === section)?.data.length ?? 0})
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onPress={() => router.push(`/(main)/session/${item.session_id}`)}
              onLongPress={() => setContextSession(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Tag filter */}
      <Modal visible={showTagFilter} animationType="slide" transparent onRequestClose={() => setShowTagFilter(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[60%]">
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
                      <Text className={`text-text13 ${selectedTags.includes(tag) ? 'text-text-always-white' : 'text-text-mid'}`}>{tag}</Text>
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
      <Modal visible={!!contextSession} animationType="fade" transparent onRequestClose={() => setContextSession(null)}>
        <Pressable className="flex-1 bg-scrim justify-center items-center" onPress={() => setContextSession(null)}>
          <View className="bg-surface2 rounded-cardLg px-2 py-2 w-64 border border-border">
            {([
              { action: 'open', icon: 'open-outline', label: 'Open session', color: tokens.textHi.hex, cls: 'text-text-hi' },
              { action: 'share_link', icon: 'share-outline', label: 'Share deep link', color: tokens.textHi.hex, cls: 'text-text-hi' },
              { action: 'archive', icon: 'archive-outline', label: 'Archive', color: tokens.textMid.hex, cls: 'text-text-mid' },
              { action: 'terminate', icon: 'stop-circle-outline', label: 'Terminate', color: tokens.failed.hex, cls: 'text-failed' },
            ] as { action: ContextAction; icon: keyof typeof Ionicons.glyphMap; label: string; color: string; cls: string }[]).map(({ action, icon, label, color, cls }) => (
              <Pressable key={action} className="flex-row items-center px-4 py-3 rounded-button" onPress={() => handleContextAction(action)}>
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

function SessionRow({ session, onPress, onLongPress }: { session: SessionResponse; onPress: () => void; onLongPress: () => void }) {
  const key = deriveStatusKey(session);
  return (
    <Pressable
      className="flex-row items-center bg-surface1 rounded-card border border-border-subtle px-4 py-3.5 mb-2"
      onPress={onPress}
      onLongPress={() => { hapticMedium(); onLongPress(); }}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${session.title || 'Untitled session'}, ${statusLabel(session)}`}
      accessibilityHint="Double tap to open. Long press for more options."
    >
      <View className={`w-2 h-2 rounded-full mr-3 ${statusDotClass(key)}`} />
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={1}>{session.title || 'Untitled session'}</Text>
        <View className="flex-row items-center mt-0.5">
          <Text className={`text-text13 ${statusColorClass(key)}`}>{statusLabel(session)}</Text>
          <Text className="text-text-low text-text12 ml-2">{relativeTime(session.updated_at)}</Text>
        </View>
      </View>
      {session.pull_requests[0] && (
        <View className="bg-tint-purple rounded-chip px-2 py-0.5 ml-2">
          <Text className="text-merged text-text12">#{prNumber(session.pull_requests[0].pr_url)}</Text>
        </View>
      )}
    </Pressable>
  );
}
