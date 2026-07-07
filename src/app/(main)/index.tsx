/**
 * Main screen — HermesX-style chat-first layout with Devin tokens.
 *
 * Top bar: Sessions title (opens drawer), search icon, ⚙ settings, + New
 * Center: Empty state with Devin avatar + prompt input + option chips
 *         (playbook, mode, tags) — submit creates a session and navigates to it
 * Drawer: Session list (slide-in from left), sectioned, with search/filter
 * Bottom: Quick access to recent sessions when no session is active
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
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSessions, useArchiveSession, useTerminateSession, useCreateSession, usePlaybooks } from '@api/devin/queries';
import { OfflineBanner } from '@components/OfflineBanner';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import { hapticLight, hapticMedium, hapticWarning, hapticSuccess, hapticError } from '@lib/haptics';
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
import type { DevinMode } from '@api/devin/types';

type ContextAction = 'open' | 'copy_link' | 'archive' | 'terminate';

const SUGGESTION_CHIPS = [
  { label: 'Build a feature', prompt: 'Build a new feature: ' },
  { label: 'Fix a bug', prompt: 'Fix this bug: ' },
  { label: 'Review code', prompt: 'Review this code and suggest improvements: ' },
  { label: 'Write tests', prompt: 'Write tests for: ' },
];

export default function MainScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useSessions('board');
  const archiveMutation = useArchiveSession();
  const terminateMutation = useTerminateSession();
  const createSession = useCreateSession();
  const { data: playbooks } = usePlaybooks();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [contextSession, setContextSession] = useState<SessionResponse | null>(null);

  // Composer state
  const [prompt, setPrompt] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [mode, setMode] = useState<DevinMode>('normal');
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = filterBySearch(data, search);
    result = filterByTags(result, selectedTags);
    return result;
  }, [data, search, selectedTags]);

  const sections = useMemo(() => sectionSessions(filtered), [filtered]);
  const allTags = useMemo(() => (data ? collectTags(data) : []), [data]);
  const recentSessions = useMemo(() => (data ?? []).slice(0, 3), [data]);

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
          { text: 'Archive', onPress: () => archiveMutation.mutate(s.session_id) },
        ]);
        break;
      case 'terminate':
        hapticWarning();
        Alert.alert('Terminate session?', 'This will stop the session immediately. This action cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Terminate', style: 'destructive', onPress: () => terminateMutation.mutate(s.session_id) },
        ]);
        break;
    }
  }

  function handleSend() {
    if (!prompt.trim() || createSession.isPending) return;
    hapticLight();
    createSession.mutate(
      {
        prompt: prompt.trim(),
        playbook_id: selectedPlaybook ?? undefined,
        devin_mode: mode,
      },
      {
        onSuccess: (session) => {
          hapticSuccess();
          setPrompt('');
          setSelectedPlaybook(null);
          setMode('normal');
          router.push(`/(main)/session/${session.session_id}`);
        },
        onError: () => hapticError(),
      },
    );
  }

  function applySuggestion(suggestionPrompt: string) {
    hapticLight();
    setPrompt(suggestionPrompt);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle">
        <Pressable
          onPress={() => setDrawerOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Open sessions list"
        >
          <View className="flex-row items-center">
            <Text className="text-text-mid text-text14 mr-2">{'\u2630'}</Text>
            <Text className="text-text-hi text-text17">DevinX</Text>
          </View>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="bg-tint-secondary rounded-button px-3 py-2"
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Search sessions"
          >
            <Text className="text-text-mid text-text13">{'\u{1F50D}'}</Text>
          </Pressable>
          <Pressable
            className="bg-tint-secondary rounded-button px-3 py-2"
            onPress={() => router.push('/(main)/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Text className="text-text-mid text-text13">{'\u2699'}</Text>
          </Pressable>
          <Pressable
            className="bg-brand rounded-button px-buttonSecondaryX py-2"
            onPress={() => router.push('/(main)/compose')}
            accessibilityRole="button"
            accessibilityLabel="New session with full options"
          >
            <Text className="text-text-always-white text-text13 font-medium">+ New</Text>
          </Pressable>
        </View>
      </View>

      <OfflineBanner />

      {/* Main content — chat-first empty state */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-1 items-center justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar with glow */}
          <View className="relative mb-5 items-center">
            <View className="absolute w-20 h-20 rounded-card opacity-30 bg-brand" />
            <View className="w-20 h-20 rounded-card bg-brand items-center justify-center relative">
              <Text className="text-text-always-white text-text17 font-mono">{'D'}</Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-text-hi text-text17 mb-2">Start a new session</Text>
          <Text className="text-text-mid text-text13 text-center mb-6">
            Describe what you want Devin to do. It'll work in the cloud and you can steer it here.
          </Text>

          {/* Prompt input */}
          <View className="w-full max-w-sm mb-3">
            <View className="bg-surface1 rounded-input border border-border-subtle px-4 py-3 min-h-[80px]">
              <TextInput
                className="text-text-hi text-text14"
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Ask Devin to build, fix, review, or research…"
                placeholderTextColor="#FFFFFF66"
                multiline
                autoCapitalize="sentences"
                autoCorrect
                accessibilityLabel="Session prompt"
                accessibilityHint="Describe what you want Devin to do"
              />
            </View>
          </View>

          {/* Option chips */}
          <View className="flex-row flex-wrap gap-2 mb-4 w-full max-w-sm">
            {/* Playbook picker */}
            <Pressable
              className={`flex-row items-center rounded-chip px-pillX py-pillY ${selectedPlaybook ? 'bg-tint-blue' : 'bg-tint-secondary'}`}
              onPress={() => setShowPlaybookPicker(true)}
            >
              <Text className={`text-text13 ${selectedPlaybook ? 'text-brand' : 'text-text-mid'}`}>
                {selectedPlaybook
                  ? playbooks?.find((p) => p.playbook_id === selectedPlaybook)?.title ?? 'Playbook'
                  : 'Playbook'}
              </Text>
              <Text className={`text-text13 ml-1 ${selectedPlaybook ? 'text-brand' : 'text-text-mid'}`}>{'\u25BE'}</Text>
            </Pressable>

            {/* Mode picker */}
            <Pressable
              className={`flex-row items-center rounded-chip px-pillX py-pillY ${mode !== 'normal' ? 'bg-tint-blue' : 'bg-tint-secondary'}`}
              onPress={() => setShowModePicker(true)}
            >
              <Text className={`text-text13 ${mode !== 'normal' ? 'text-brand' : 'text-text-mid'}`}>
                {mode === 'fast' ? 'Fast' : 'Normal'}
              </Text>
              <Text className={`text-text13 ml-1 ${mode !== 'normal' ? 'text-brand' : 'text-text-mid'}`}>{'\u25BE'}</Text>
            </Pressable>
          </View>

          {/* Send button */}
          <Pressable
            className={`rounded-button px-buttonPrimaryX py-buttonPrimaryY w-full max-w-sm items-center ${prompt.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
            onPress={handleSend}
            disabled={!prompt.trim() || createSession.isPending}
            accessibilityRole="button"
            accessibilityLabel="Start session"
          >
            {createSession.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className={`text-text14 font-medium ${prompt.trim() ? 'text-text-always-white' : 'text-text-mid'}`}>
                Start session {'\u2192'}
              </Text>
            )}
          </Pressable>

          {/* Suggestion chips */}
          <View className="flex-row flex-wrap gap-2 mt-6 justify-center w-full max-w-sm">
            {SUGGESTION_CHIPS.map((chip) => (
              <Pressable
                key={chip.label}
                className="bg-tint-secondary rounded-chip px-pillX py-pillY"
                onPress={() => applySuggestion(chip.prompt)}
              >
                <Text className="text-text-mid text-text13">{chip.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent sessions quick access */}
          {recentSessions.length > 0 && (
            <View className="mt-8 w-full max-w-sm">
              <Text className="text-text-low text-text12 font-medium uppercase tracking-wider mb-3">
                Recent
              </Text>
              {recentSessions.map((session) => (
                <Pressable
                  key={session.session_id}
                  className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2"
                  onPress={() => router.push(`/(main)/session/${session.session_id}`)}
                >
                  <View className={`w-2 h-2 rounded-full mr-3 ${statusDotClass(deriveStatusKey(session))}`} />
                  <View className="flex-1 min-w-0">
                    <Text className="text-text-hi text-text14" numberOfLines={1}>
                      {session.title || 'Untitled session'}
                    </Text>
                    <Text className={`text-text13 ${statusColorClass(deriveStatusKey(session))}`}>
                      {statusLabel(session)} · {relativeTime(session.updated_at)}
                    </Text>
                  </View>
                </Pressable>
              ))}
              <Pressable className="mt-2 py-2" onPress={() => setDrawerOpen(true)}>
                <Text className="text-brand text-text13 text-center">View all sessions</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sessions drawer */}
      <Modal visible={drawerOpen} animationType="slide" transparent onRequestClose={() => setDrawerOpen(false)}>
        <View className="flex-1 bg-scrim">
          <Pressable className="flex-1" onPress={() => setDrawerOpen(false)} />
          <View className="absolute top-0 bottom-0 left-0 w-[85%] max-w-[340px] bg-surface0">
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
              {/* Drawer header */}
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle">
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
                    className="bg-tint-secondary rounded-button px-3 py-2"
                    onPress={() => setDrawerOpen(false)}
                    accessibilityLabel="Close sessions list"
                  >
                    <Text className="text-text-mid text-text13">{'\u2715'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Search */}
              <View className="px-4 py-2">
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

              {/* Session list */}
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
                      onPress={() => {
                        setDrawerOpen(false);
                        router.push(`/(main)/session/${item.session_id}`);
                      }}
                      onLongPress={() => setContextSession(item)}
                    />
                  )}
                  refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#4489FF" />
                  }
                  stickySectionHeadersEnabled={false}
                />
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Tag filter modal */}
      <Modal visible={showTagFilter} animationType="slide" transparent onRequestClose={() => setShowTagFilter(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[60%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Filter by tags</Text>
              <Pressable onPress={() => setShowTagFilter(false)}>
                <Text className="text-brand text-text14">Done</Text>
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
                      <Text className={`text-text13 ${selectedTags.includes(tag) ? 'text-text-always-white' : 'text-text-mid'}`}>
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

      {/* Playbook picker modal */}
      <Modal visible={showPlaybookPicker} animationType="slide" transparent onRequestClose={() => setShowPlaybookPicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[60%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select playbook</Text>
              <Pressable onPress={() => setShowPlaybookPicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${!selectedPlaybook ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => { setSelectedPlaybook(null); setShowPlaybookPicker(false); }}
              >
                <Text className={`text-text14 ${!selectedPlaybook ? 'text-brand font-medium' : 'text-text-hi'}`}>
                  No playbook
                </Text>
              </Pressable>
              {playbooks?.map((pb) => (
                <Pressable
                  key={pb.playbook_id}
                  className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${selectedPlaybook === pb.playbook_id ? 'bg-tint-blue' : 'bg-surface1'}`}
                  onPress={() => { setSelectedPlaybook(pb.playbook_id); setShowPlaybookPicker(false); }}
                >
                  <Text className={`text-text14 flex-1 ${selectedPlaybook === pb.playbook_id ? 'text-brand font-medium' : 'text-text-hi'}`}>
                    {pb.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mode picker modal */}
      <Modal visible={showModePicker} animationType="slide" transparent onRequestClose={() => setShowModePicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface2 rounded-t-sheet px-5 py-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Execution mode</Text>
              <Pressable onPress={() => setShowModePicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {(['normal', 'fast'] as DevinMode[]).map((m) => (
              <Pressable
                key={m}
                className={`flex-row items-center justify-between px-4 py-3 rounded-card mb-2 ${mode === m ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => { setMode(m); setShowModePicker(false); }}
              >
                <View>
                  <Text className={`text-text14 ${mode === m ? 'text-brand font-medium' : 'text-text-hi'}`}>
                    {m === 'fast' ? 'Fast' : 'Normal'}
                  </Text>
                  <Text className="text-text-mid text-text12 mt-0.5">
                    {m === 'fast' ? 'Quick tasks, lower cost' : 'Full capability, best quality'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Long-press context menu */}
      <Modal visible={!!contextSession} animationType="fade" transparent onRequestClose={() => setContextSession(null)}>
        <Pressable className="flex-1 bg-scrim justify-center items-center" onPress={() => setContextSession(null)}>
          <View className="bg-surface2 rounded-card px-2 py-2 w-64">
            <Pressable
              className="px-4 py-3 rounded-button"
              onPress={() => handleContextAction('open')}
            >
              <Text className="text-text-hi text-text14">Open session</Text>
            </Pressable>
            <Pressable
              className="px-4 py-3 rounded-button"
              onPress={() => handleContextAction('copy_link')}
            >
              <Text className="text-text-hi text-text14">Copy deep link</Text>
            </Pressable>
            <Pressable
              className="px-4 py-3 rounded-button"
              onPress={() => handleContextAction('archive')}
            >
              <Text className="text-text-mid text-text14">Archive</Text>
            </Pressable>
            <Pressable
              className="px-4 py-3 rounded-button"
              onPress={() => handleContextAction('terminate')}
            >
              <Text className="text-failed text-text14">Terminate</Text>
            </Pressable>
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
              <View key={tag} className="bg-tint-secondary rounded-chip px-2 py-0.5 mr-1">
                <Text className="text-text-mid text-text12">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {session.pull_requests.length > 0 && session.pull_requests[0] && (
        <View className="bg-tint-purple rounded-chip px-2 py-0.5 ml-2">
          <Text className="text-merged text-text12">#{prNumber(session.pull_requests[0].pr_url)}</Text>
        </View>
      )}
    </Pressable>
  );
}
