/**
 * Main screen — chat-first layout matching the Devin desktop composer
 * (specs/reference-ui/01-home-composer.png) with Devin tokens.
 *
 * Top bar: menu (opens drawer), DevinX title, search, settings, + New
 * Center: wordmark row + composer card (prompt, playbook/mode chips, send)
 * Below: recent sessions card list
 * Drawer: full session list (slide-in), sectioned, with search/tag filter
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import { useSessions, useArchiveSession, useTerminateSession, useCreateSession, usePlaybooks, useCodeScanFindings } from '@api/devin/queries';
import { OfflineBanner } from '@components/OfflineBanner';
import { ModeSettings } from '@components/ModeSettings';
import { BoardSkeleton, EmptyState, ErrorState } from '@components/Skeletons';
import { hapticLight, hapticMedium, hapticWarning, hapticSuccess, hapticError } from '@lib/haptics';
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
  modeLabel,
} from '@lib/session-utils';
import type { SessionResponse } from '@api/devin/types';
import ICON_MARK from '../../../assets/brand/icon-transparent.png';
import type { DevinMode } from '@api/devin/types';

type ContextAction = 'open' | 'share_link' | 'archive' | 'terminate';

const MAX_PROMPT = 10000;

/**
 * Devin sidebar products — all native screens. Wiki (DeepWiki) is omitted
 * (no public API), and Security only appears when the key can actually
 * reach the enterprise code-scans API — no dead nav items.
 */
type NavItem = { icon: keyof typeof Ionicons.glyphMap; label: string; route: string };

export default function MainScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useSessions('board');
  const archiveMutation = useArchiveSession();
  const terminateMutation = useTerminateSession();
  const createSession = useCreateSession();
  const { data: playbooks } = usePlaybooks();
  const { data: scanFindings } = useCodeScanFindings();
  const { tokens } = useTheme();

  const navItems: NavItem[] = [
    { icon: 'time-outline', label: 'Automations', route: '/(main)/automations' },
    // Enterprise-gated: only show when the key can actually list findings.
    ...(scanFindings
      ? [{ icon: 'shield-outline' as const, label: 'Security', route: '/(main)/security' }]
      : []),
    { icon: 'git-pull-request-outline', label: 'Review', route: '/(main)/review' },
  ];

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
  const [composerError, setComposerError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = filterBySearch(data, search);
    result = filterByTags(result, selectedTags);
    return result;
  }, [data, search, selectedTags]);

  const sections = useMemo(() => sectionSessions(filtered), [filtered]);
  const allTags = useMemo(() => (data ? collectTags(data) : []), [data]);
  const recentSessions = useMemo(() => (data ?? []).slice(0, 4), [data]);

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
        Share.share({ message: `devinx://session/${s.session_id}` }).catch(() => {
          // Share sheet unavailable (e.g. desktop web) — nothing to do.
        });
        break;
      case 'archive':
        hapticWarning();
        confirmAction(
          {
            title: 'Archive session?',
            message: 'This will archive the session. You can unarchive it from the Devin web app.',
            confirmLabel: 'Archive',
          },
          () => archiveMutation.mutate(s.session_id),
        );
        break;
      case 'terminate':
        hapticWarning();
        confirmAction(
          {
            title: 'Terminate session?',
            message: 'This will stop the session immediately. This action cannot be undone.',
            confirmLabel: 'Terminate',
            destructive: true,
          },
          () => terminateMutation.mutate(s.session_id),
        );
        break;
    }
  }

  function handleSend() {
    if (!prompt.trim() || createSession.isPending) return;
    hapticLight();
    setComposerError(null);
    createSession.mutate(
      {
        prompt: prompt.trim().slice(0, MAX_PROMPT),
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
        onError: (e) => {
          hapticError();
          setComposerError(e instanceof Error ? e.message : 'Could not create session.');
        },
      },
    );
  }

  const selectedPlaybookTitle = selectedPlaybook
    ? (playbooks?.find((p) => p.playbook_id === selectedPlaybook)?.title ?? 'Playbook')
    : null;

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border-subtle">
        <Pressable
          className="flex-row items-center py-1"
          onPress={() => setDrawerOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Open sessions list"
        >
          <Ionicons name="menu-outline" size={22} color={tokens.textMid.hex} />
          <Image source={ICON_MARK} className="w-5 h-5 ml-2" resizeMode="contain" />
          <Text className="text-text-hi text-text16 font-medium ml-1.5">DevinX</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center"
            onPress={() => setDrawerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Search sessions"
          >
            <Ionicons name="search-outline" size={17} color={tokens.textMid.hex} />
          </Pressable>
          <Pressable
            className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center"
            onPress={() => router.push('/(main)/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={17} color={tokens.textMid.hex} />
          </Pressable>
          <Pressable
            className="flex-row items-center bg-brand rounded-button px-3 py-2"
            onPress={() => router.push('/(main)/compose')}
            accessibilityRole="button"
            accessibilityLabel="New session with full options"
          >
            <Ionicons name="add" size={16} color={tokens.textAlwaysWhite.hex} />
            <Text className="text-text-always-white text-text13 font-medium ml-1">New</Text>
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
          contentContainerClassName="flex-grow justify-center px-4 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Devin wordmark row */}
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center">
              <Image source={ICON_MARK} className="w-5 h-5 mr-2" resizeMode="contain" />
              <Text className="text-text-hi text-text16 font-medium">Devin</Text>
            </View>
            <View className="flex-row bg-tint-secondary rounded-chip p-0.5">
              <View className="bg-surface2 rounded-chip px-3 py-1">
                <Text className="text-text-hi text-text12 font-medium">Agent</Text>
              </View>
            </View>
          </View>

          {/* Composer card */}
          <View className="bg-surface1 rounded-2xl border border-border mb-2">
            <TextInput
              className="text-text-hi text-text14 px-4 pt-4 pb-2 min-h-[76px]"
              value={prompt}
              onChangeText={(v) => setPrompt(v.slice(0, MAX_PROMPT))}
              placeholder="Ask Devin to build features, fix bugs, or work on your code"
              placeholderTextColor={tokens.textLow.hex}
              multiline
              maxLength={MAX_PROMPT}
              autoCapitalize="sentences"
              autoCorrect
              textAlignVertical="top"
              accessibilityLabel="Session prompt"
              accessibilityHint="Describe what you want Devin to do"
            />
            {/* Composer bottom row */}
            <View className="flex-row items-center justify-between px-3 pb-3">
              <View className="flex-row items-center gap-1">
                {/* + opens full compose */}
                <Pressable
                  className="w-8 h-8 rounded-full items-center justify-center"
                  onPress={() => router.push('/(main)/compose')}
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  accessibilityHint="Open full composer with title, tags, knowledge, and attachments"
                >
                  <Ionicons name="add" size={20} color={tokens.textMid.hex} />
                </Pressable>
                {/* Mode picker */}
                <Pressable
                  className="flex-row items-center rounded-button px-2 py-1.5"
                  onPress={() => setShowModePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Execution mode"
                >
                  <Ionicons name="options-outline" size={15} color={tokens.textMid.hex} />
                  <Text className="text-text-mid text-text13 ml-1.5">
                    {modeLabel(mode)}
                  </Text>
                </Pressable>
                {/* Playbook picker */}
                <Pressable
                  className="flex-row items-center rounded-button px-2 py-1.5"
                  onPress={() => setShowPlaybookPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select playbook"
                >
                  <Ionicons
                    name="book-outline"
                    size={14}
                    color={selectedPlaybook ? tokens.brandText.hex : tokens.textMid.hex}
                  />
                  <Text
                    className={`text-text13 ml-1.5 max-w-32 ${selectedPlaybook ? 'text-brand-text' : 'text-text-mid'}`}
                    numberOfLines={1}
                  >
                    {selectedPlaybookTitle ?? 'Playbook'}
                  </Text>
                </Pressable>
              </View>
              {/* Circular send button */}
              <Pressable
                className={`w-8 h-8 rounded-full items-center justify-center ${prompt.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
                onPress={handleSend}
                disabled={!prompt.trim() || createSession.isPending}
                accessibilityRole="button"
                accessibilityLabel="Start session"
              >
                {createSession.isPending ? (
                  <ActivityIndicator color={tokens.textAlwaysWhite.hex} size="small" />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={17}
                    color={prompt.trim() ? tokens.textAlwaysWhite.hex : tokens.textLow.hex}
                  />
                )}
              </Pressable>
            </View>
          </View>
          {composerError && (
            <View className="flex-row items-center bg-tint-red rounded-card px-3 py-2 mb-2">
              <Ionicons name="alert-circle-outline" size={14} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{composerError}</Text>
            </View>
          )}

          {/* Recent sessions — compact Devin-desktop style */}
          {recentSessions.length > 0 && (
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-2 px-1">
                <Text className="text-text-mid text-text13">Recent sessions</Text>
                <Pressable onPress={() => setDrawerOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text className="text-link text-text13">View all</Text>
                </Pressable>
              </View>
              <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden">
                {recentSessions.map((session, i) => (
                  <Pressable
                    key={session.session_id}
                    className={`px-4 py-3 ${i < recentSessions.length - 1 ? 'border-b border-border-subtle' : ''}`}
                    onPress={() => router.push(`/(main)/session/${session.session_id}`)}
                    onLongPress={() => {
                      hapticMedium();
                      setContextSession(session);
                    }}
                    delayLongPress={400}
                    accessibilityRole="button"
                    accessibilityLabel={`${session.title || 'Untitled session'}, ${statusLabel(session)}`}
                  >
                    <Text className="text-text-hi text-text13" numberOfLines={1}>
                      {session.title || 'Untitled session'}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className={`text-text12 ${statusColorClass(deriveStatusKey(session))}`}>
                        {statusLabel(session)}
                      </Text>
                      <Text className="text-text-low text-text12 ml-2">
                        {relativeTime(session.updated_at)}
                      </Text>
                      {session.pull_requests.length > 0 && session.pull_requests[0] && (
                        <View className="flex-row items-center ml-auto">
                          <Ionicons name="git-pull-request-outline" size={12} color={tokens.merged.hex} />
                          <Text className="text-merged text-text12 ml-1">
                            #{prNumber(session.pull_requests[0].pr_url)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sessions drawer — fade, not slide: Modal's slide animates from the
          bottom of the screen, which looks wrong for a left-side drawer. */}
      <Modal visible={drawerOpen} animationType="fade" transparent onRequestClose={() => setDrawerOpen(false)}>
        <View className="flex-1 bg-scrim">
          <Pressable className="flex-1" onPress={() => setDrawerOpen(false)} />
          <View className="absolute top-0 bottom-0 left-0 w-[85%] max-w-[340px] bg-surface0 border-r border-border">
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
              {/* Drawer header */}
              <View className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-row items-center">
                  <Image source={ICON_MARK} className="w-5 h-5 mr-2" resizeMode="contain" />
                  <Text className="text-text-hi text-text16 font-medium">DevinX</Text>
                </View>
                <Pressable
                  className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center"
                  onPress={() => setDrawerOpen(false)}
                  accessibilityLabel="Close sessions list"
                >
                  <Ionicons name="close" size={17} color={tokens.textMid.hex} />
                </Pressable>
              </View>

              {/* Primary nav — mirrors the Devin sidebar */}
              <View className="px-2 pb-2">
                <Pressable
                  className="flex-row items-center bg-tint-primary rounded-button px-3 py-2.5 mb-1"
                  onPress={() => {
                    setDrawerOpen(false);
                    router.push('/(main)/compose');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="New session"
                >
                  <Ionicons name="add" size={17} color={tokens.textHi.hex} />
                  <Text className="text-text-hi text-text14 font-medium ml-3">New session</Text>
                </Pressable>
                {navItems.map(({ icon, label, route }) => (
                  <Pressable
                    key={label}
                    className="flex-row items-center rounded-button px-3 py-2.5"
                    onPress={() => {
                      hapticLight();
                      setDrawerOpen(false);
                      router.push(route as never);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Ionicons name={icon} size={16} color={tokens.textMid.hex} />
                    <Text className="text-text-mid text-text14 ml-3 flex-1">{label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Recent header */}
              <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
                <Text className="text-text-low text-text12 font-medium uppercase tracking-wider">Recent</Text>
                <Pressable
                  className={`rounded-chip px-2.5 py-1 ${selectedTags.length > 0 ? 'bg-brand' : 'bg-tint-secondary'}`}
                  onPress={() => setShowTagFilter(true)}
                >
                  <Text className={`text-text12 font-medium ${selectedTags.length > 0 ? 'text-text-always-white' : 'text-text-mid'}`}>
                    Tags{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
                  </Text>
                </Pressable>
              </View>

              {/* Search */}
              <View className="px-4 py-2">
                <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
                  <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
                  <TextInput
                    className="flex-1 text-text14 text-text-hi ml-2"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search sessions…"
                    placeholderTextColor={tokens.textLow.hex}
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
                        <Text className="text-brand-text text-text12 mr-1">{tag}</Text>
                        <Ionicons name="close" size={11} color={tokens.brandText.hex} />
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
                    <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
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
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${!selectedPlaybook ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => { setSelectedPlaybook(null); setShowPlaybookPicker(false); }}
              >
                <Text className={`text-text14 ${!selectedPlaybook ? 'text-brand-text font-medium' : 'text-text-hi'}`}>
                  No playbook
                </Text>
              </Pressable>
              {playbooks?.map((pb) => (
                <Pressable
                  key={pb.playbook_id}
                  className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${selectedPlaybook === pb.playbook_id ? 'bg-tint-blue' : 'bg-surface1'}`}
                  onPress={() => { setSelectedPlaybook(pb.playbook_id); setShowPlaybookPicker(false); }}
                >
                  <Text className={`text-text14 flex-1 ${selectedPlaybook === pb.playbook_id ? 'text-brand-text font-medium' : 'text-text-hi'}`}>
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
              <Text className="text-text-hi text-text17">Session settings</Text>
              <Pressable onPress={() => setShowModePicker(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            <ModeSettings
              mode={mode}
              onChange={setMode}
              checkColor={tokens.brandText.hex}
              mutedColor={tokens.textLow.hex}
            />
          </View>
        </View>
      </Modal>

      {/* Long-press context menu */}
      <Modal visible={!!contextSession} animationType="fade" transparent onRequestClose={() => setContextSession(null)}>
        <Pressable className="flex-1 bg-scrim justify-center items-center" onPress={() => setContextSession(null)}>
          <View className="bg-surface2 rounded-2xl px-2 py-2 w-64 border border-border">
            <Pressable
              className="flex-row items-center px-4 py-3 rounded-button"
              onPress={() => handleContextAction('open')}
            >
              <Ionicons name="open-outline" size={16} color={tokens.textHi.hex} />
              <Text className="text-text-hi text-text14 ml-3">Open session</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 rounded-button"
              onPress={() => handleContextAction('share_link')}
            >
              <Ionicons name="share-outline" size={16} color={tokens.textHi.hex} />
              <Text className="text-text-hi text-text14 ml-3">Share deep link</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 rounded-button"
              onPress={() => handleContextAction('archive')}
            >
              <Ionicons name="archive-outline" size={16} color={tokens.textMid.hex} />
              <Text className="text-text-mid text-text14 ml-3">Archive</Text>
            </Pressable>
            <Pressable
              className="flex-row items-center px-4 py-3 rounded-button"
              onPress={() => handleContextAction('terminate')}
            >
              <Ionicons name="stop-circle-outline" size={16} color={tokens.failed.hex} />
              <Text className="text-failed text-text14 ml-3">Terminate</Text>
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
