/**
 * Home — Perplexity-style hero composer.
 * Top-left menu (slide-over) for navigation, a friendly prompt, a large
 * rounded composer, and a compact recent-sessions list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import {
  useComputerSessions,
  useComputerCreateOptions,
  useCreateComputerSession,
  type ComputerSessionListItem,
} from '@api/bridge/queries';
import {
  useSessions,
  useCreateSession,
  usePlaybooks,
  useCodeScanFindings,
  useUploadAttachment,
  useRepositories,
} from '@api/devin/queries';
import { OfflineBanner } from '@components/OfflineBanner';
import { NavMenu } from '@components/NavMenu';
import { ModeSettings } from '@components/ModeSettings';
import { AttachmentPickerSheet, type PickedAttachment } from '@components/AttachmentPickerSheet';
import { DevinCompanion } from '@components/pets';
import {
  ComputerDiscoveryNotices,
  ComputerSessionRow,
} from '@components/sessions/ComputerSessionRow';
import { useConnections } from '@auth/ConnectionContext';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import { connectionModeUsesComputer } from '@lib/connections';
import { rememberSessionMode, rememberSessionRepository } from '@lib/session-repository';
import {
  deriveStatusKey,
  statusColorClass,
  statusLabel,
  relativeTime,
  prNumber,
  modeLabel,
} from '@lib/session-utils';
import type { DevinMode } from '@api/devin/types';
import type { SessionResponse } from '@api/devin/types';
import { useAppPreferences } from '@store/preferences';
import WORDMARK_DARK from '../../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../../assets/wordmark-light.png';

const MAX_PROMPT = 10000;

type RecentSession =
  | { kind: 'cloud'; session: SessionResponse; updatedAt: number }
  | { kind: 'computer'; session: ComputerSessionListItem; updatedAt: number };

export default function HomeScreen() {
  const router = useRouter();
  const { name, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const defaultTags = useAppPreferences((state) => state.defaultTags);
  const { data: sessions } = useSessions('board');
  const computerSessions = useComputerSessions();
  const {
    mode: connectionMode,
    hasCloudConnection,
    usesCloud,
    computers = [],
  } = useConnections();
  const usesComputer = connectionModeUsesComputer(connectionMode);
  const canCreateCloudSession = usesCloud && hasCloudConnection;
  const [selectedComputerBridgeId, setSelectedComputerBridgeId] = useState<string | null>(
    computers[0]?.bridgeId ?? null,
  );
  const computer =
    computers.find((candidate) => candidate.bridgeId === selectedComputerBridgeId) ?? computers[0];
  const [destination, setDestination] = useState<'cloud' | 'computer'>(
    connectionMode === 'computer' ? 'computer' : 'cloud',
  );
  const localOptions = useComputerCreateOptions(
    computer?.bridgeId ?? '',
    destination === 'computer' && Boolean(computer),
  );
  const createComputerSession = useCreateComputerSession(computer?.bridgeId ?? '');
  const createSession = useCreateSession();
  const uploadAttachment = useUploadAttachment();
  const { data: playbooks } = usePlaybooks();
  const { data: repositories, isLoading: repositoriesLoading } = useRepositories();
  const { data: scanFindings } = useCodeScanFindings();

  const [prompt, setPrompt] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [mode, setMode] = useState<DevinMode>('normal');
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [repoQuery, setRepoQuery] = useState('');
  const [showModePicker, setShowModePicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [attachments, setAttachments] = useState<
    { name: string; url: string; previewUri?: string }[]
  >([]);
  const [uploadingAttachmentName, setUploadingAttachmentName] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [companionActive, setCompanionActive] = useState(false);

  useEffect(() => {
    if (connectionMode === 'computer') setDestination('computer');
    if (connectionMode === 'cloud') setDestination('cloud');
  }, [connectionMode]);

  useEffect(() => {
    if (!computers.some((candidate) => candidate.bridgeId === selectedComputerBridgeId)) {
      setSelectedComputerBridgeId(computers[0]?.bridgeId ?? null);
    }
  }, [computers, selectedComputerBridgeId]);

  useEffect(() => {
    const options = localOptions.data;
    if (!options) return;
    if (!options.workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(options.workspaces[0]?.id ?? null);
    }
    if (
      selectedModelId !== null &&
      !options.models.some((model) => model.id === selectedModelId)
    ) {
      setSelectedModelId(null);
    }
  }, [localOptions.data, selectedModelId, selectedWorkspaceId]);

  useFocusEffect(
    useCallback(() => {
      setCompanionActive(true);
      return () => setCompanionActive(false);
    }, []),
  );

  const recent = useMemo<RecentSession[]>(() => {
    const cloudItems: RecentSession[] = (usesCloud ? (sessions ?? []) : []).map((session) => ({
      kind: 'cloud',
      session,
      updatedAt: session.updated_at * 1_000,
    }));
    const computerItems: RecentSession[] = (
      usesComputer ? (computerSessions.data?.sessions ?? []) : []
    ).map((session) => ({
      kind: 'computer',
      session,
      updatedAt: session.updatedAt ? Date.parse(session.updatedAt) : 0,
    }));
    return [...cloudItems, ...computerItems]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 5);
  }, [computerSessions.data?.sessions, sessions, usesCloud, usesComputer]);
  const selectedPlaybookTitle = selectedPlaybook
    ? (playbooks?.find((p) => p.playbook_id === selectedPlaybook)?.title ?? 'Playbook')
    : null;
  const selectedRepoName = selectedRepo?.split('/').filter(Boolean).pop() ?? 'Any repository';
  const localCreationPending = createComputerSession.isPending;
  const companionState = composerError
    ? 'error'
    : createSession.isPending || localCreationPending
      ? 'working'
      : 'idle';
  const isComputerDestination = destination === 'computer';
  const canChooseDestination = connectionMode === 'both' || computers.length > 1;
  const selectedWorkspace = localOptions.data?.workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );
  const selectedModel = localOptions.data?.models.find((model) => model.id === selectedModelId);
  const canCreateComputerSession = Boolean(
    computer && selectedWorkspaceId && !localOptions.isLoading && !localOptions.error,
  );
  const canUseComposer = isComputerDestination
    ? canCreateComputerSession
    : canCreateCloudSession;
  const composerPending = createSession.isPending || createComputerSession.isPending;
  const normalizedRepoQuery = repoQuery.trim().toLowerCase();
  const filteredRepositories = (repositories ?? []).filter(
    (repository) =>
      normalizedRepoQuery.length === 0 ||
      repository.repo_name.toLowerCase().includes(normalizedRepoQuery) ||
      repository.repo_path.toLowerCase().includes(normalizedRepoQuery),
  );
  const companionSize = Math.round(Math.min(height < 700 ? 184 : 220, Math.max(164, width * 0.54)));

  async function handleAttachment(file: PickedAttachment) {
    setComposerError(null);
    setUploadingAttachmentName(file.name);
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      setAttachments((current) => [
        ...current,
        {
          name: uploaded.name,
          url: uploaded.url,
          previewUri: file.type.startsWith('image/') ? file.uri : undefined,
        },
      ]);
    } catch (error) {
      hapticError();
      const message = error instanceof Error ? error.message : 'Could not upload attachment.';
      setComposerError(message);
      Alert.alert('Upload failed', message);
    } finally {
      setUploadingAttachmentName(null);
    }
  }

  function handleSend() {
    if (isComputerDestination) {
      if (
        !computer ||
        !selectedWorkspaceId ||
        !prompt.trim() ||
        createComputerSession.isPending
      ) {
        return;
      }
      hapticLight();
      setComposerError(null);
      createComputerSession.mutate(
        {
          workspaceId: selectedWorkspaceId,
          modelId: selectedModelId,
          text: prompt.trim().slice(0, MAX_PROMPT),
        },
        {
          onSuccess: ({ sessionId }) => {
            hapticSuccess();
            setPrompt('');
            router.push(`/computer-session/${computer.bridgeId}/${sessionId}?continuing=1`);
          },
          onError: (error) => {
            hapticError();
            setComposerError(
              error instanceof Error
                ? error.message
                : 'The local session could not be created.',
            );
          },
        },
      );
      return;
    }
    if (
      !canCreateCloudSession ||
      !prompt.trim() ||
      createSession.isPending ||
      uploadAttachment.isPending
    ) {
      return;
    }
    hapticLight();
    setComposerError(null);
    createSession.mutate(
      {
        prompt: prompt.trim().slice(0, MAX_PROMPT),
        playbook_id: selectedPlaybook ?? undefined,
        repos: selectedRepo ? [selectedRepo] : undefined,
        devin_mode: mode,
        tags: defaultTags.length > 0 ? defaultTags : undefined,
        attachment_urls:
          attachments.length > 0 ? attachments.map((attachment) => attachment.url) : undefined,
      },
      {
        onSuccess: (session) => {
          hapticSuccess();
          Promise.all([
            rememberSessionRepository(session.session_id, selectedRepo),
            rememberSessionMode(session.session_id, mode),
          ]).catch(() => {});
          setPrompt('');
          setSelectedPlaybook(null);
          setSelectedRepo(null);
          setMode('normal');
          setAttachments([]);
          router.push(`/(main)/session/${session.session_id}`);
        },
        onError: (e) => {
          hapticError();
          setComposerError(e instanceof Error ? e.message : 'Could not create session.');
        },
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Balanced top bar keeps the wordmark centered at every width. */}
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <Pressable
          className="w-10 h-10 rounded-full items-center justify-center"
          onPress={() => setShowMenu(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Menu"
        >
          <Ionicons name="menu" size={24} color={tokens.textMid.hex} />
        </Pressable>
        <View className="flex-1 items-center">
          <Image
            source={name === 'light' ? WORDMARK_LIGHT : WORDMARK_DARK}
            className="w-28 h-7"
            resizeMode="contain"
            accessibilityLabel="DevinX"
          />
        </View>
        <View className="w-10 h-10 items-center justify-center" accessible={false}>
          <Ionicons
            name={
              connectionMode === 'computer'
                ? 'desktop-outline'
                : connectionMode === 'both'
                  ? 'layers-outline'
                  : 'cloud-outline'
            }
            size={23}
            color={tokens.textMid.hex}
          />
        </View>
      </View>

      <NavMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        showSecurity={!!scanFindings}
      />

      <OfflineBanner />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow px-5 pt-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {/* Readiness context is informational, not a misleading tap target. */}
          <View className="rounded-cardLg border border-border-subtle bg-surface1 px-4 py-3">
            <View className="flex-row items-start">
              <View className="mt-1.5 mr-3 h-2 w-2 rounded-full bg-brand" />
              <View className="flex-1">
                <Text className="text-text-hi text-text15 font-medium">
                  Devin is ready to build
                </Text>
                <Text className="mt-1 text-text-mid text-text13">
                  {connectionMode === 'computer'
                    ? 'Monitor sessions running through your paired Mac.'
                    : connectionMode === 'both'
                      ? 'Cloud and paired-Mac sessions appear together.'
                      : 'Ask anything. Devin runs in the cloud.'}
                </Text>
              </View>
            </View>
          </View>

          {/* Devin is the home-screen visual anchor, not a floating overlay. */}
          <View className="items-center justify-center py-3">
            <DevinCompanion
              state={companionState}
              size={companionSize}
              active={companionActive}
              accessibilityLabel={`Devin companion, ${companionState}`}
            />
          </View>

          {/* One clean composer surface; no additional card around it. */}
          <Text className="mb-3 text-text-hi text-text17 font-medium">
            What should Devin build?
          </Text>
          <View className="rounded-cardLg border border-border bg-surface1">
            <TextInput
              className="text-text-hi text-text16 px-5 pt-5 pb-3 min-h-[112px]"
              value={prompt}
              onChangeText={(v) => setPrompt(v.slice(0, MAX_PROMPT))}
              editable={canUseComposer}
              placeholder={
                isComputerDestination
                  ? 'Ask Devin on your Mac to build, fix, or investigate…'
                  : 'Ask Devin to build features, fix bugs, or work on your code…'
              }
              placeholderTextColor={tokens.textLow.hex}
              multiline
              maxLength={MAX_PROMPT}
              autoCapitalize="sentences"
              autoCorrect
              textAlignVertical="top"
              accessibilityLabel="Session prompt"
            />
            {!isComputerDestination && (attachments.length > 0 || uploadingAttachmentName) && (
              <View className="flex-row flex-wrap px-4 pb-2">
                {uploadingAttachmentName && (
                  <View className="flex-row items-center bg-tint-blue rounded-chip px-pillX py-pillY mr-2 mb-1">
                    <ActivityIndicator size="small" color={tokens.brandText.hex} />
                    <Text className="text-brand-text text-text12 ml-1.5 max-w-40" numberOfLines={1}>
                      Uploading {uploadingAttachmentName}…
                    </Text>
                  </View>
                )}
                {attachments.map((attachment) => (
                  <Pressable
                    key={attachment.url}
                    className="flex-row items-center bg-tint-secondary rounded-chip px-pillX py-pillY mr-2 mb-1"
                    onPress={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.url !== attachment.url),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${attachment.name}`}
                  >
                    {attachment.previewUri ? (
                      <Image
                        source={{ uri: attachment.previewUri }}
                        className="w-6 h-6 rounded-chip"
                      />
                    ) : (
                      <Ionicons name="attach" size={12} color={tokens.textMid.hex} />
                    )}
                    <Text
                      className="text-text-mid text-text12 ml-1 mr-1 max-w-40"
                      numberOfLines={1}
                    >
                      {attachment.name}
                    </Text>
                    <Ionicons name="close" size={11} color={tokens.textLow.hex} />
                  </Pressable>
                ))}
              </View>
            )}
            <View className="flex-row items-center justify-between px-4 pb-4">
              <View className="flex-row items-center gap-1">
                <Pressable
                  className="w-9 h-9 rounded-full items-center justify-center"
                  onPress={() => setShowAttachmentPicker(true)}
                  disabled={isComputerDestination || !canCreateCloudSession || uploadAttachment.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Add attachment"
                >
                  {uploadAttachment.isPending ? (
                    <ActivityIndicator size="small" color={tokens.brandText.hex} />
                  ) : (
                    <Ionicons name="add" size={22} color={tokens.textMid.hex} />
                  )}
                </Pressable>
                {isComputerDestination ? (
                  <Pressable
                    className="flex-row items-center rounded-full px-3 py-2"
                    onPress={() => setShowModelPicker(true)}
                    disabled={!localOptions.data}
                    accessibilityRole="button"
                    accessibilityLabel={`Model: ${selectedModel?.name ?? 'Default'}`}
                  >
                    <Ionicons name="hardware-chip-outline" size={15} color={tokens.textMid.hex} />
                    <Text className="text-text-mid text-text13 ml-1.5 max-w-36" numberOfLines={1}>
                      {selectedModel?.name ?? 'Default model'}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      className="flex-row items-center rounded-full px-3 py-2"
                      onPress={() => setShowModePicker(true)}
                      disabled={!canCreateCloudSession}
                      accessibilityRole="button"
                      accessibilityLabel="Execution mode"
                    >
                      <Ionicons name="options-outline" size={15} color={tokens.textMid.hex} />
                      <Text className="text-text-mid text-text13 ml-1.5">{modeLabel(mode)}</Text>
                    </Pressable>
                    <Pressable
                      className="flex-row items-center rounded-full px-3 py-2"
                      onPress={() => setShowPlaybookPicker(true)}
                      disabled={!canCreateCloudSession}
                      accessibilityRole="button"
                      accessibilityLabel="Select playbook"
                    >
                      <Ionicons
                        name="book-outline"
                        size={14}
                        color={selectedPlaybook ? tokens.brandText.hex : tokens.textMid.hex}
                      />
                      <Text
                        className={`text-text13 ml-1.5 max-w-28 ${selectedPlaybook ? 'text-brand-text' : 'text-text-mid'}`}
                        numberOfLines={1}
                      >
                        {selectedPlaybookTitle ?? 'Playbook'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
              <Pressable
                className={`w-10 h-10 rounded-full items-center justify-center ${canUseComposer && prompt.trim() && !uploadAttachment.isPending ? 'bg-brand' : 'bg-tint-secondary'}`}
                onPress={handleSend}
                disabled={
                  !canUseComposer ||
                  !prompt.trim() ||
                  composerPending ||
                  uploadAttachment.isPending
                }
                accessibilityRole="button"
                accessibilityLabel="Start session"
              >
                {composerPending ? (
                  <ActivityIndicator color={tokens.textAlwaysWhite.hex} size="small" />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={
                      canUseComposer && prompt.trim() && !uploadAttachment.isPending
                        ? tokens.textAlwaysWhite.hex
                        : tokens.textLow.hex
                    }
                  />
                )}
              </Pressable>
            </View>
          </View>
          <View className="flex-row items-center px-2 pt-2 gap-4">
            <Pressable
              className="flex-row items-center"
              onPress={() => canChooseDestination && setShowDestinationPicker(true)}
              disabled={!canChooseDestination}
              accessibilityRole="button"
              accessibilityLabel={`Session destination: ${isComputerDestination ? computer?.computerName ?? 'Computer' : 'Devin Cloud'}`}
            >
              <Ionicons
                name={isComputerDestination ? 'desktop-outline' : 'cloud-outline'}
                size={14}
                color={tokens.textLow.hex}
              />
              <Text className="text-text-mid text-text12 ml-1.5" numberOfLines={1}>
                {isComputerDestination ? computer?.computerName ?? 'Computer' : 'Devin Cloud'}
              </Text>
              {canChooseDestination && (
                <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
              )}
            </Pressable>
            <Pressable
              className="flex-row items-center flex-1 min-w-0"
              onPress={() => {
                if (isComputerDestination) {
                  setShowWorkspacePicker(true);
                } else {
                  setRepoQuery('');
                  setShowRepoPicker(true);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isComputerDestination
                  ? `Workspace: ${selectedWorkspace?.name ?? 'Unavailable'}`
                  : `Repository: ${selectedRepo ?? 'Any repository'}`
              }
            >
              <Ionicons name="folder-outline" size={15} color={tokens.textLow.hex} />
              <Text className="text-text-mid text-text12 ml-1.5 flex-1" numberOfLines={1}>
                {isComputerDestination
                  ? selectedWorkspace?.name ?? 'Select workspace'
                  : selectedRepoName}
              </Text>
              <Ionicons name="chevron-down" size={13} color={tokens.textLow.hex} />
            </Pressable>
          </View>
          {isComputerDestination && localOptions.error && (
            <Text className="px-2 pt-2 text-failed text-text12">
              Open DevinX Connector and allow this iPhone to create sessions.
            </Text>
          )}
          {composerError && (
            <View className="flex-row items-center bg-tint-red rounded-card px-3 py-2 mt-3">
              <Ionicons name="alert-circle-outline" size={14} color={tokens.failed.hex} />
              <Text className="text-failed text-text12 ml-2 flex-1">{composerError}</Text>
            </View>
          )}

          <View className="mt-3">
            <ComputerDiscoveryNotices
              computers={usesComputer ? (computerSessions.data?.computers ?? []) : []}
            />
          </View>

          {/* Recent */}
          {recent.length > 0 && (
            <View className="mt-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-text-hi text-text16 font-medium">Recent</Text>
                <Pressable
                  onPress={() => router.push('/(main)/sessions')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-brand-text text-text13">View all</Text>
                </Pressable>
              </View>
              <View className="gap-2">
                {recent.map((item) =>
                  item.kind === 'computer' ? (
                    <ComputerSessionRow
                      key={`computer:${item.session.bridgeId}:${item.session.id}`}
                      session={item.session}
                      compact
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
                    <Pressable
                      key={`cloud:${item.session.session_id}`}
                      className="bg-surface1 rounded-card border border-border-subtle px-4 py-3.5"
                      onPress={() => router.push(`/(main)/session/${item.session.session_id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.session.title || 'Untitled session'}, ${statusLabel(item.session)}`}
                    >
                      <Text className="text-text-hi text-text14" numberOfLines={1}>
                        {item.session.title || 'Untitled session'}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Text
                          className={`text-text12 ${statusColorClass(deriveStatusKey(item.session))}`}
                        >
                          {statusLabel(item.session)}
                        </Text>
                        <Text className="text-text-low text-text12 ml-2">
                          {relativeTime(item.session.updated_at)}
                        </Text>
                        {item.session.pull_requests[0] && (
                          <View className="flex-row items-center ml-auto">
                            <Ionicons
                              name="git-pull-request-outline"
                              size={12}
                              color={tokens.merged.hex}
                            />
                            <Text className="text-merged text-text12 ml-1">
                              #{prNumber(item.session.pull_requests[0].pr_url)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        statusBarTranslucent
        visible={showRepoPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRepoPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet pt-3 max-h-[78%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            accessibilityViewIsModal
          >
            <View className="self-center h-1 w-10 rounded-full bg-border mb-3" />
            <View className="flex-row items-center justify-between px-5 mb-4">
              <View>
                <Text className="text-text-hi text-text17 font-medium">Select repository</Text>
                <Text className="text-text-low text-text12 mt-0.5">
                  Choose the codebase Devin should work in
                </Text>
              </View>
              <Pressable
                className="w-10 h-10 rounded-full items-center justify-center bg-tint-secondary"
                onPress={() => setShowRepoPicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Close repository picker"
              >
                <Ionicons name="close" size={19} color={tokens.textMid.hex} />
              </Pressable>
            </View>

            <View className="mx-5 mb-4 h-11 flex-row items-center rounded-card border border-border bg-surface1 px-3">
              <Ionicons name="search" size={17} color={tokens.textLow.hex} />
              <TextInput
                className="ml-2 flex-1 text-text-hi text-text14"
                value={repoQuery}
                onChangeText={setRepoQuery}
                placeholder="Search repositories"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search repositories"
              />
              {repoQuery.length > 0 && (
                <Pressable
                  className="w-8 h-8 items-center justify-center"
                  onPress={() => setRepoQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear repository search"
                >
                  <Ionicons name="close-circle" size={17} color={tokens.textLow.hex} />
                </Pressable>
              )}
            </View>

            <View className="flex-row items-center justify-between px-5 mb-2">
              <Text className="text-text-low text-text12 font-medium uppercase tracking-wide">
                Connected repositories
              </Text>
              {!repositoriesLoading && (
                <Text className="text-text-low text-text12">{filteredRepositories.length}</Text>
              )}
            </View>

            <ScrollView contentContainerClassName="px-5 pb-2" keyboardShouldPersistTaps="handled">
              <View className="overflow-hidden rounded-cardLg border border-border-subtle bg-surface1">
                <Pressable
                  className={`min-h-16 flex-row items-center px-4 py-3 border-b border-border-subtle ${selectedRepo === null ? 'bg-tint-blue' : ''}`}
                  onPress={() => {
                    setSelectedRepo(null);
                    setRepoQuery('');
                    setShowRepoPicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Use any repository"
                >
                  <View
                    className={`w-9 h-9 rounded-card items-center justify-center mr-3 ${selectedRepo === null ? 'bg-brand' : 'bg-tint-secondary'}`}
                  >
                    <Ionicons
                      name="git-branch-outline"
                      size={17}
                      color={
                        selectedRepo === null ? tokens.textAlwaysWhite.hex : tokens.textMid.hex
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-text14 ${selectedRepo === null ? 'text-brand-text font-medium' : 'text-text-hi'}`}
                    >
                      Any repository
                    </Text>
                    <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                      Let Devin choose from connected repositories
                    </Text>
                  </View>
                  {selectedRepo === null && (
                    <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                  )}
                </Pressable>

                {repositoriesLoading && (
                  <View className="items-center justify-center py-8">
                    <ActivityIndicator color={tokens.brandText.hex} />
                  </View>
                )}

                {!repositoriesLoading &&
                  filteredRepositories.map((repository, index) => {
                    const isSelected = selectedRepo === repository.repo_path;
                    return (
                      <Pressable
                        key={repository.provider_repository_id}
                        className={`min-h-16 flex-row items-center px-4 py-3 ${index < filteredRepositories.length - 1 ? 'border-b border-border-subtle' : ''} ${isSelected ? 'bg-tint-blue' : ''}`}
                        onPress={() => {
                          setSelectedRepo(repository.repo_path);
                          setRepoQuery('');
                          setShowRepoPicker(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Use repository ${repository.repo_path}`}
                      >
                        <View
                          className={`w-9 h-9 rounded-card items-center justify-center mr-3 ${isSelected ? 'bg-brand' : 'bg-tint-secondary'}`}
                        >
                          <Ionicons
                            name="folder-outline"
                            size={17}
                            color={isSelected ? tokens.textAlwaysWhite.hex : tokens.textMid.hex}
                          />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text
                            className={`text-text14 ${isSelected ? 'text-brand-text font-medium' : 'text-text-hi'}`}
                            numberOfLines={1}
                          >
                            {repository.repo_name}
                          </Text>
                          <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                            {repository.repo_path}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={tokens.brandText.hex}
                          />
                        )}
                      </Pressable>
                    );
                  })}

                {!repositoriesLoading && filteredRepositories.length === 0 && (
                  <View className="items-center px-5 py-8">
                    <Ionicons name="search-outline" size={22} color={tokens.textLow.hex} />
                    <Text className="text-text-mid text-text14 mt-2">
                      {repoQuery.trim()
                        ? 'No repositories match your search.'
                        : 'No connected repositories found.'}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        statusBarTranslucent
        visible={showDestinationPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDestinationPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            accessibilityViewIsModal
          >
            <Text className="mb-4 text-text-hi text-text17 font-medium">Run this session on</Text>
            {canCreateCloudSession && (
              <Pressable
                className={`mb-2 flex-row items-center rounded-card border border-border-subtle px-4 py-4 ${destination === 'cloud' ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => {
                  setDestination('cloud');
                  setShowDestinationPicker(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Use Devin Cloud"
              >
                <Ionicons name="cloud-outline" size={19} color={tokens.brandText.hex} />
                <View className="ml-3 flex-1">
                  <Text className="text-text-hi text-text14 font-medium">Devin Cloud</Text>
                  <Text className="mt-0.5 text-text-low text-text12">
                    Cloud repositories, playbooks, attachments, and Devin modes
                  </Text>
                </View>
              </Pressable>
            )}
            {computers.map((computerOption, index) => {
              const selected =
                destination === 'computer' && computerOption.bridgeId === computer?.bridgeId;
              return (
                <Pressable
                  key={computerOption.bridgeId}
                  className={`flex-row items-center rounded-card border border-border-subtle px-4 py-4 ${index > 0 || canCreateCloudSession ? 'mt-2' : ''} ${selected ? 'bg-tint-blue' : 'bg-surface1'}`}
                  onPress={() => {
                    setSelectedComputerBridgeId(computerOption.bridgeId);
                    setSelectedWorkspaceId(null);
                    setSelectedModelId(null);
                    setDestination('computer');
                    setShowDestinationPicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${computerOption.computerName}`}
                >
                  <Ionicons name="desktop-outline" size={19} color={tokens.brandText.hex} />
                  <View className="ml-3 flex-1">
                    <Text className="text-text-hi text-text14 font-medium">
                      {computerOption.computerName}
                    </Text>
                    <Text className="mt-0.5 text-text-low text-text12">
                      Local workspaces and models supplied by Devin on this computer
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        statusBarTranslucent
        visible={showWorkspacePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWorkspacePicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[65%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            accessibilityViewIsModal
          >
            <Text className="mb-1 text-text-hi text-text17 font-medium">Select workspace</Text>
            <Text className="mb-4 text-text-low text-text12">
              Approved workspaces previously used by Devin on this Mac
            </Text>
            <ScrollView>
              {localOptions.data?.workspaces.map((workspace) => {
                const selected = workspace.id === selectedWorkspaceId;
                return (
                  <Pressable
                    key={workspace.id}
                    className={`mb-2 flex-row items-center rounded-card border border-border-subtle px-4 py-3.5 ${selected ? 'bg-tint-blue' : 'bg-surface1'}`}
                    onPress={() => {
                      setSelectedWorkspaceId(workspace.id);
                      setShowWorkspacePicker(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use workspace ${workspace.name}`}
                  >
                    <Ionicons name="folder-outline" size={18} color={tokens.textMid.hex} />
                    <Text className="ml-3 flex-1 text-text-hi text-text14" numberOfLines={1}>
                      {workspace.name}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        statusBarTranslucent
        visible={showModelPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[65%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            accessibilityViewIsModal
          >
            <Text className="mb-1 text-text-hi text-text17 font-medium">Select local model</Text>
            <Text className="mb-4 text-text-low text-text12">
              Choose a Devin model, or keep Devin's recommended default
            </Text>
            <ScrollView>
              <Pressable
                className={`mb-2 flex-row items-center rounded-card border border-border-subtle px-4 py-3.5 ${selectedModelId === null ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => {
                  setSelectedModelId(null);
                  setShowModelPicker(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Use Devin default model"
              >
                <Ionicons name="sparkles-outline" size={18} color={tokens.textMid.hex} />
                <View className="ml-3 flex-1">
                  <Text className="text-text-hi text-text14">Default model</Text>
                  <Text className="mt-0.5 text-text-low text-text12">
                    Let Devin choose the recommended model
                  </Text>
                </View>
                {selectedModelId === null && (
                  <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                )}
              </Pressable>
              {localOptions.data?.models.map((modelOption) => {
                const selected = modelOption.id === selectedModelId;
                return (
                  <Pressable
                    key={modelOption.id}
                    className={`mb-2 flex-row items-center rounded-card border border-border-subtle px-4 py-3.5 ${selected ? 'bg-tint-blue' : 'bg-surface1'}`}
                    onPress={() => {
                      setSelectedModelId(modelOption.id);
                      setShowModelPicker(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use model ${modelOption.name}`}
                  >
                    <Ionicons name="hardware-chip-outline" size={18} color={tokens.textMid.hex} />
                    <Text className="ml-3 flex-1 text-text-hi text-text14" numberOfLines={1}>
                      {modelOption.name}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AttachmentPickerSheet
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onPick={handleAttachment}
      />

      {/* Playbook picker */}
      <Modal
        statusBarTranslucent
        visible={showPlaybookPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPlaybookPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[60%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select playbook</Text>
              <Pressable onPress={() => setShowPlaybookPicker(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Pressable
                className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${!selectedPlaybook ? 'bg-tint-blue' : 'bg-surface1'}`}
                onPress={() => {
                  setSelectedPlaybook(null);
                  setShowPlaybookPicker(false);
                }}
              >
                <Text
                  className={`text-text14 ${!selectedPlaybook ? 'text-brand-text font-medium' : 'text-text-hi'}`}
                >
                  No playbook
                </Text>
              </Pressable>
              {playbooks?.map((pb) => (
                <Pressable
                  key={pb.playbook_id}
                  className={`flex-row items-center px-4 py-3 rounded-card mb-2 ${selectedPlaybook === pb.playbook_id ? 'bg-tint-blue' : 'bg-surface1'}`}
                  onPress={() => {
                    setSelectedPlaybook(pb.playbook_id);
                    setShowPlaybookPicker(false);
                  }}
                >
                  <Text
                    className={`text-text14 flex-1 ${selectedPlaybook === pb.playbook_id ? 'text-brand-text font-medium' : 'text-text-hi'}`}
                  >
                    {pb.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mode picker */}
      <Modal
        statusBarTranslucent
        visible={showModePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModePicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
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
    </SafeAreaView>
  );
}
