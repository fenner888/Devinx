/**
 * Session Board — spec §7.2.
 * Sectioned layout (Needs input / Working / Recent / Sleeping),
 * search bar, tag filter chips, long-press context menu, pull-to-refresh.
 */
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, TextInput, SectionList, Modal, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessions, useArchiveSession, useTerminateSession } from '@api/devin/queries';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import { OfflineBanner } from '@components/OfflineBanner';
import { hapticLight, hapticMedium, hapticWarning } from '@lib/haptics';
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

type ContextAction = 'open' | 'copy_link' | 'archive' | 'terminate';

export default function BoardScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useSessions('board');
  const archiveMutation = useArchiveSession();
  const terminateMutation = useTerminateSession();

  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [contextSession, setContextSession] = useState<SessionResponse | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = filterBySearch(data, search);
    result = filterByTags(result, selectedTags);
    return result;
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
      case 'copy_link':
        hapticLight();
        Share.share({ message: `devinx://session/${s.session_id}` });
        break;
      case 'archive':
        hapticWarning();
        Alert.alert('Archive session?', 'This will archive the session. You can unarchive it from the Devin web app.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: () => archiveMutation.mutate(s.session_id),
          },
        ]);
        break;
      case 'terminate':
        hapticWarning();
        Alert.alert('Terminate session?', 'This will stop the session immediately. This action cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Terminate',
            style: 'destructive',
            onPress: () => terminateMutation.mutate(s.session_id),
          },
        ]);
        break;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-text-hi text-text17">Sessions</Text>
        <View className="flex-row gap-2">
          <Pressable
            className={`rounded-button px-3 py-2 ${selectedTags.length > 0 ? 'bg-brand' : 'bg-tint-secondary'}`}
            onPress={() => setShowTagFilter(true)}
          >
            <Text className={`text-text13 font-medium ${selectedTags.length > 0 ? 'text-text-always-white' : 'text-text-mid'}`}>
              Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
            </Text>
          </Pressable>
          <Pressable
            className="bg-brand rounded-button px-buttonSecondaryX py-2"
            onPress={() => router.push('/(main)/compose')}
          >
            <Text className="text-text-always-white text-text13 font-medium">+ New</Text>
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Text className="text-text-low text-text14 mr-2">{'\u{1F50D}'}</Text>
          <TextInput
            className="flex-1 text-text14 text-text-hi"
            value={search}
            onChangeText={setSearch}
            placeholder="Search sessions…"
            placeholderTextColor="#FFFFFF66"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search sessions"
            accessibilityHint="Search by session title, tags, or session ID"
          />
        </View>
      </View>

      {/* Active tag chips */}
      {selectedTags.length > 0 && (
        <View className="px-4 pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedTags.map((tag) => (
              <Pressable
                key={tag}
                className="bg-tint-primary rounded-chip px-pillX py-pillY mr-2 flex-row items-center"
                onPress={() => toggleTag(tag)}
              >
                <Text className="text-brand text-text12 mr-1">{tag}</Text>
                <Text className="text-brand text-text12">{'\u00D7'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Offline banner */}
      <OfflineBanner />

      {/* Loading */}
      {isLoading && <BoardSkeleton />}

      {/* Error */}
      {error && (
        <ErrorState
          title="Could not load sessions"
          message={error.message}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={data && data.length > 0 ? 'No matches' : 'No sessions yet'}
          message={data && data.length > 0
            ? 'No sessions match your search or tag filters.'
            : 'Start a new session to see it here.'}
        />
      )}

      {/* Sectioned list */}
      {!error && filtered.length > 0 && (
        <SectionList
          className="flex-1 px-4"
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
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#4489FF" />
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Tag filter modal */}
      <Modal visible={showTagFilter} animationType="slide" transparent onRequestClose={() => setShowTagFilter(false)}>
        <View className="flex-1 bg-scrim/50 justify-end">
          <View className="bg-surface1 rounded-t-card px-5 py-6 max-h-[60%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Filter by tags</Text>
              <Pressable onPress={() => setShowTagFilter(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {allTags.length === 0 ? (
              <Text className="text-text-mid text-text14">No tags in your sessions.</Text>
            ) : (
              <ScrollView>
                <View className="flex-row flex-wrap">
                  {allTags.map(({ tag, count }) => (
                    <Pressable
                      key={tag}
                      className={`rounded-chip px-pillX py-pillY mr-2 mb-2 ${selectedTags.includes(tag) ? 'bg-brand' : 'bg-tint-secondary'}`}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text className={`text-text13 ${selectedTags.includes(tag) ? 'text-text-always-white' : 'text-text-mid'}`}>
                        {tag} ({count})
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

      {/* Long-press context menu */}
      <Modal visible={!!contextSession} animationType="fade" transparent onRequestClose={() => setContextSession(null)}>
        <Pressable className="flex-1 bg-scrim/50 justify-center items-center" onPress={() => setContextSession(null)}>
          <View className="bg-surface1 rounded-card px-5 py-4 w-[80%] max-w-sm">
            <Text className="text-text-hi text-text14 mb-4" numberOfLines={2}>
              {contextSession?.title || 'Untitled session'}
            </Text>
            {([
              { action: 'open' as const, label: 'Open session' },
              { action: 'copy_link' as const, label: 'Copy deep link' },
              { action: 'archive' as const, label: 'Archive' },
              { action: 'terminate' as const, label: 'Terminate' },
            ]).map(({ action, label }) => (
              <Pressable
                key={action}
                className="py-3 border-b border-border-subtle last:border-b-0"
                onPress={() => handleContextAction(action)}
              >
                <Text className={`text-text14 ${action === 'terminate' ? 'text-failed' : 'text-text-hi'}`}>{label}</Text>
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
  onPress,
  onLongPress,
}: {
  session: SessionResponse;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const key = deriveStatusKey(session);
  const label = statusLabel(session);
  const colorClass = statusColorClass(key);
  const dotClass = statusDotClass(key);

  return (
    <Pressable
      className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2"
      onPress={onPress}
      onLongPress={() => {
        hapticMedium();
        onLongPress();
      }}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${session.title || 'Untitled session'}, ${label}`}
      accessibilityHint="Double tap to open session details. Long press for more options."
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {/* Status dot */}
      <View className={`w-2 h-2 rounded-full mr-3 ${dotClass}`} />
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={1}>
          {session.title || 'Untitled session'}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className={`text-text13 ${colorClass}`}>{label}</Text>
          <Text className="text-text-low text-text12 ml-2">{relativeTime(session.updated_at)}</Text>
        </View>
        {session.tags.length > 0 && (
          <View className="flex-row mt-1">
            {session.tags.slice(0, 3).map((tag) => (
              <View key={tag} className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-1">
                <Text className="text-text-low text-text11">{tag}</Text>
              </View>
            ))}
            {session.tags.length > 3 && (
              <Text className="text-text-low text-text11 ml-1">+{session.tags.length - 3}</Text>
            )}
          </View>
        )}
      </View>
      {session.pull_requests.length > 0 && (
        <View className="bg-tint-green rounded-chip px-pillX py-pillY ml-2">
          <Text className="text-finished text-text12 font-medium">
            #{prNumber(session.pull_requests[0]?.pr_url ?? '')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
