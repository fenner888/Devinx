/**
 * Session Detail — spec §7.3.
 * Header with status, title, PR badges.
 * Tabbed: Timeline (messages) | Worklog | Changes (PRs) | Insights.
 * Timeline matches the Devin desktop chat (specs/reference-ui/03b): Devin
 * messages render as plain text, user messages as right-aligned bubbles.
 * Message steering: send message to session.
 * Polls with useSession + useMessages hooks.
 */
import { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  RefreshControl,
  Alert,
  Image,
  Keyboard,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useSession,
  useMessages,
  useSendMessage,
  useUpdateTags,
  useInsights,
  useGenerateInsights,
  useUploadAttachment,
} from '@api/devin/queries';
import { isValidSessionId } from '@lib/deepLink';
import { SessionDetailSkeleton, ErrorState } from '@components/Skeletons';
import { hapticLight, hapticSuccess, hapticError } from '@lib/haptics';
import {
  deriveStatusKey,
  statusColorClass,
  statusDotClass,
  statusLabel,
  relativeTime,
  prNumber,
  modeLabel,
} from '@lib/session-utils';
import type { DevinMode, SessionMessage } from '@api/devin/types';
import { useTheme } from '@theme/index';
import { DevinMarkdown } from '@components/DevinMarkdown';
import { AttachmentPickerSheet, type PickedAttachment } from '@components/AttachmentPickerSheet';
import { DevinCompanion } from '@components/pets';
import {
  VoiceComposerStatus,
  VoiceMicButton,
  useVoiceComposer,
} from '@components/VoiceInput';
import { getSessionMode, getSessionRepository } from '@lib/session-repository';
import { activityForCloudSession } from '@/pets/devin/activity';

type Tab = 'timeline' | 'worklog' | 'changes' | 'insights';

function BackButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
    </Pressable>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('timeline');
  const [messageText, setMessageText] = useState('');
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [messageAttachments, setMessageAttachments] = useState<
    { name: string; url: string; previewUri?: string }[]
  >([]);
  const [uploadingAttachmentName, setUploadingAttachmentName] = useState<string | null>(null);
  const [sessionRepository, setSessionRepository] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<DevinMode | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editedTags, setEditedTags] = useState<string[] | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  // Optimistically-echoed user message, shown instantly until the real one lands.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [companionActive, setCompanionActive] = useState(false);

  const validId = id && isValidSessionId(id) ? id : undefined;
  const { data: session, isLoading, error, refetch } = useSession(validId);
  const { data: messagesData } = useMessages(validId);
  const messages = messagesData?.items;
  const sendMessage = useSendMessage(validId);
  const uploadAttachment = useUploadAttachment();
  const updateTags = useUpdateTags(validId);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const voice = useVoiceComposer({
    value: messageText,
    onChangeText: setMessageText,
    disabled: !session || sendMessage.isPending,
    hints: {
      repositories: sessionRepository ? [sessionRepository] : [],
      tags: session?.tags ?? [],
    },
    scribeContext: {
      destination: 'Devin Cloud',
      repository: sessionRepository ?? undefined,
    },
  });

  useFocusEffect(
    useCallback(() => {
      setCompanionActive(true);
      return () => setCompanionActive(false);
    }, []),
  );

  // Clear the optimistic echo once the real user message shows up in the list.
  useEffect(() => {
    if (pendingText && messages?.some((m) => m.source === 'user' && m.message === pendingText)) {
      setPendingText(null);
    }
  }, [messages, pendingText]);

  useEffect(() => {
    let active = true;
    if (session) {
      Promise.all([getSessionRepository(session), getSessionMode(session.session_id)]).then(
        ([repository, mode]) => {
          if (active) {
            setSessionRepository(repository);
            setSessionMode(mode);
          }
        },
      );
    }
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (!validId) {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center" edges={['top']}>
        <Text className="text-failed text-text14">Invalid session ID</Text>
        <Pressable className="mt-4" onPress={() => router.back()}>
          <Text className="text-brand-text text-text14">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="flex-row items-center px-4 py-3">
          <BackButton onPress={() => router.back()} />
        </View>
        <SessionDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="flex-row items-center px-4 py-3">
          <BackButton onPress={() => router.back()} />
        </View>
        <ErrorState
          title="Could not load session"
          message={error?.message ?? 'Unknown error'}
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  const statusKey = deriveStatusKey(session);
  const colorClass = statusColorClass(statusKey);
  const dotClass = statusDotClass(statusKey);
  const label = statusLabel(session);
  // You can message any non-terminal session. Sending to a suspended
  // (sleeping) session automatically resumes it (per the Devin API), so the
  // composer must show there too — only truly ended sessions hide it.
  const canSend = session.status !== 'exit' && session.status !== 'error';
  const sessionRepositoryName =
    sessionRepository?.split('/').filter(Boolean).pop() ?? 'Repository unavailable';

  async function handleAttachment(file: PickedAttachment) {
    setUploadingAttachmentName(file.name);
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      setMessageAttachments((current) => [
        ...current,
        {
          name: uploaded.name,
          url: uploaded.url,
          previewUri: file.type.startsWith('image/') ? file.uri : undefined,
        },
      ]);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Could not upload attachment.';
      Alert.alert('Upload failed', message);
    } finally {
      setUploadingAttachmentName(null);
    }
  }

  function handleSend() {
    const text = messageText.trim();
    if (!text || sendMessage.isPending || uploadAttachment.isPending) return;
    hapticLight();
    // Give the timeline back the full viewport as soon as the user sends so
    // the response and Devin's walking state are not hidden by the keyboard.
    Keyboard.dismiss();
    // Echo the message immediately, clear the input, then send.
    const attachments = messageAttachments;
    setPendingText(text);
    setMessageText('');
    setMessageAttachments([]);
    sendMessage.mutate(
      {
        message: text,
        attachmentUrls:
          attachments.length > 0 ? attachments.map((attachment) => attachment.url) : undefined,
      },
      {
        onSuccess: () => hapticSuccess(),
        onError: () => {
          hapticError();
          // Restore the draft so nothing is lost, and drop the echo.
          setPendingText(null);
          setMessageText(text);
          setMessageAttachments(attachments);
        },
      },
    );
  }

  // Devin is "working" while the session is live or a send is in flight —
  // drives the live typing indicator at the bottom of the timeline.
  const isWorking =
    sendMessage.isPending ||
    !!pendingText ||
    session.status === 'running' ||
    session.status === 'resuming' ||
    session.status_detail === 'working';
  const companionIsSending = sendMessage.isPending || !!pendingText;
  const companionActivity = activityForCloudSession(session, statusKey, companionIsSending);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border-subtle">
        <View className="flex-row items-center mb-2">
          <BackButton onPress={() => router.back()} />
          <View className={`w-2 h-2 rounded-full mr-2 ${dotClass}`} />
          <Text className={`text-text13 ${colorClass}`}>{label}</Text>
          <Text className="text-text-low text-text12 ml-auto">
            {relativeTime(session.updated_at)}
          </Text>
        </View>
        <Text className="text-text-hi text-text17 mb-1">{session.title || 'Untitled session'}</Text>
        <View className="flex-row items-center">
          <Text className="text-text-low text-text12">{session.session_id}</Text>
          <Text className="text-text-low text-text12 ml-3">{session.acus_consumed} ACU</Text>
          {session.origin && (
            <Text className="text-text-low text-text12 ml-3 capitalize">{session.origin}</Text>
          )}
        </View>
        {/* PR badges */}
        {session.pull_requests.length > 0 && (
          <View className="flex-row mt-2">
            {session.pull_requests.map((pr, i) => (
              <Pressable
                key={i}
                className={`flex-row items-center rounded-chip px-pillX py-pillY mr-2 ${pr.state === 'merged' ? 'bg-tint-purple' : 'bg-tint-green'}`}
                onPress={() => pr.pr_url && Linking.openURL(pr.pr_url)}
              >
                <Ionicons
                  name="git-pull-request-outline"
                  size={12}
                  color={pr.state === 'merged' ? tokens.merged.hex : tokens.finished.hex}
                />
                <Text
                  className={`text-text12 font-medium ml-1 ${pr.state === 'merged' ? 'text-merged' : 'text-finished'}`}
                >
                  #{prNumber(pr.pr_url)}
                  {pr.state === 'merged' ? ' Merged' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {/* Tags (tap to edit) */}
        <Pressable
          className="flex-row items-center flex-wrap mt-2"
          onPress={() => {
            setEditedTags([...session.tags]);
            setTagError(null);
            setShowTagEditor(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Edit tags"
        >
          {session.tags.map((tag) => (
            <View key={tag} className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-1 mb-1">
              <Text className="text-text-low text-text11">{tag}</Text>
            </View>
          ))}
          <View className="rounded-chip px-pillX py-pillY border border-border-subtle mb-1">
            <Text className="text-text-low text-text11">
              {session.tags.length > 0 ? '+ Edit' : '+ Add tags'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-border-subtle">
        {[
          { key: 'timeline' as const, label: 'Timeline' },
          { key: 'worklog' as const, label: 'Worklog' },
          { key: 'changes' as const, label: 'Changes' },
          { key: 'insights' as const, label: 'Insights' },
        ].map(({ key, label: tabLabel }) => (
          <Pressable
            key={key}
            className={`flex-1 py-3 items-center ${tab === key ? 'border-b-2 border-brand' : ''}`}
            onPress={() => setTab(key)}
          >
            <Text
              className={`text-text13 ${tab === key ? 'text-brand-text font-medium' : 'text-text-mid'}`}
            >
              {tabLabel}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content + steering bar — one KeyboardAvoidingView so the message
          list shrinks (not just the input) and the layout doesn't jump. */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1">
          {tab === 'timeline' && (
            <TimelineTab
              messages={messages ?? []}
              isLoading={isLoading}
              pendingText={pendingText}
              isSending={sendMessage.isPending}
              isWorking={isWorking}
            />
          )}
          {tab === 'worklog' && <WorklogTab session={session} />}
          {tab === 'changes' && <ChangesTab session={session} />}
          {tab === 'insights' && <InsightsTab sessionId={validId} />}
          {/* Foreground-only track: conversation scrolls behind it. It has no
              shelf/background and never consumes a layout row. */}
          {tab === 'timeline' && (
            <View
              pointerEvents="none"
              className="absolute inset-x-0 bottom-0 px-4 pb-1"
              testID="cloud-session-companion-dock"
            >
              <DevinCompanion
                state={companionActivity.state}
                size={keyboardVisible ? 72 : 104}
                message={companionActivity.message}
                active={companionActive}
                travel={companionActivity.travel}
                travelTrack
                accessibilityLabel={`Devin companion, ${companionActivity.message ?? companionActivity.state}`}
              />
            </View>
          )}
        </View>

        {/* Message steering composer — any non-terminal session (sleeping resumes).
            It floats above the home indicator instead of becoming a bottom shelf. */}
        {canSend && (
          <View
            className="bg-canvas px-4 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom + 8, 16) }}
            testID="cloud-session-composer-shell"
          >
            {session.status === 'suspended' && (
              <Text className="text-text-low text-text12 px-1 pb-1.5">
                Sleeping — sending a message will wake Devin.
              </Text>
            )}
            {(messageAttachments.length > 0 || uploadingAttachmentName) && (
              <View className="flex-row flex-wrap px-1 pb-2">
                {uploadingAttachmentName && (
                  <View className="flex-row items-center bg-tint-blue rounded-chip px-pillX py-pillY mr-2 mb-1">
                    <ActivityIndicator size="small" color={tokens.brandText.hex} />
                    <Text className="text-brand-text text-text12 ml-1.5 max-w-40" numberOfLines={1}>
                      Uploading {uploadingAttachmentName}…
                    </Text>
                  </View>
                )}
                {messageAttachments.map((attachment) => (
                  <Pressable
                    key={attachment.url}
                    className="flex-row items-center bg-tint-secondary rounded-chip px-pillX py-pillY mr-2 mb-1"
                    onPress={() =>
                      setMessageAttachments((current) =>
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
            <View
              className="rounded-card border border-border bg-surface1 px-3 pt-2 pb-2"
              testID="cloud-session-composer"
            >
              <TextInput
                ref={voice.inputRef}
                className="min-h-[44px] max-h-24 px-1 text-text-hi text-text14"
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Ask Devin to build features, fix bugs, or work on your code"
                placeholderTextColor={tokens.textLow.hex}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Cloud session message"
                onSelectionChange={voice.onSelectionChange}
              />
              <VoiceComposerStatus voice={voice} />
              <View
                className={`mt-1 flex-row items-center justify-between ${voice.isRecording ? 'hidden' : ''}`}
              >
                <View className="flex-row items-center">
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-full"
                    onPress={() => setShowAttachmentPicker(true)}
                    disabled={uploadAttachment.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Add attachment"
                  >
                    {uploadAttachment.isPending ? (
                      <ActivityIndicator size="small" color={tokens.brandText.hex} />
                    ) : (
                      <Ionicons name="add" size={22} color={tokens.textMid.hex} />
                    )}
                  </Pressable>
                </View>
                <View className="flex-row items-center gap-1">
                  <VoiceMicButton voice={voice} disabled={sendMessage.isPending} />
                  <Pressable
                    className={`h-10 w-10 items-center justify-center rounded-full ${messageText.trim() && !sendMessage.isPending && !uploadAttachment.isPending ? 'bg-brand' : 'bg-tint-secondary'}`}
                    disabled={
                      !messageText.trim() || sendMessage.isPending || uploadAttachment.isPending
                    }
                    onPress={handleSend}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    {sendMessage.isPending ? (
                      <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={19}
                        color={
                          messageText.trim() && !uploadAttachment.isPending
                            ? tokens.textAlwaysWhite.hex
                            : tokens.textLow.hex
                        }
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
            <View className="flex-row items-center px-1 pt-2">
              <View className="flex-row items-center mr-4">
                <Ionicons name="cloud-outline" size={14} color={tokens.textLow.hex} />
                <Text className="text-text-low text-text12 ml-1.5">Devin Cloud</Text>
              </View>
              <View
                className="flex-row items-center mr-4"
                accessibilityLabel={`Session mode: ${sessionMode ? modeLabel(sessionMode) : 'Unavailable'}`}
              >
                <Ionicons name="speedometer-outline" size={14} color={tokens.textLow.hex} />
                <Text className="text-text-low text-text12 ml-1.5">
                  {sessionMode ? `${modeLabel(sessionMode)} mode` : 'Mode unavailable'}
                </Text>
              </View>
              <View
                className="flex-row items-center flex-1"
                accessibilityLabel={`Repository: ${sessionRepository ?? 'Unavailable'}`}
              >
                <Ionicons name="folder-outline" size={15} color={tokens.textLow.hex} />
                <Text className="text-text-mid text-text12 ml-1.5 flex-1" numberOfLines={1}>
                  {sessionRepositoryName}
                </Text>
              </View>
            </View>
            {sendMessage.isError && (
              <Text className="text-failed text-text12 mt-1 px-1">
                Message failed to send — your draft is preserved above. Tap send to retry.
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <AttachmentPickerSheet
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onPick={handleAttachment}
      />

      {/* Tag editor modal */}
      <Modal
        statusBarTranslucent
        visible={showTagEditor}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTagEditor(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface2 rounded-t-sheet px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Edit tags</Text>
              <Pressable
                onPress={() => {
                  if (editedTags) {
                    setTagError(null);
                    updateTags.mutate(editedTags, {
                      onSuccess: () => setShowTagEditor(false),
                      onError: (e) => {
                        hapticError();
                        setTagError(e instanceof Error ? e.message : 'Could not save tags.');
                      },
                    });
                  } else {
                    setShowTagEditor(false);
                  }
                }}
              >
                {updateTags.isPending ? (
                  <ActivityIndicator size="small" color={tokens.brand.hex} />
                ) : (
                  <Text className="text-brand-text text-text14">Save</Text>
                )}
              </Pressable>
            </View>
            <View className="flex-row items-center bg-surface1 rounded-input px-3 py-2 mb-3">
              <TextInput
                className="flex-1 text-text14 text-text-hi"
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag…"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const tag = tagInput.trim().toLowerCase();
                  if (tag && editedTags && !editedTags.includes(tag) && editedTags.length < 50) {
                    setEditedTags([...editedTags, tag]);
                  }
                  setTagInput('');
                }}
              />
            </View>
            {tagError && <Text className="text-failed text-text12 mb-2">{tagError}</Text>}
            {editedTags && editedTags.length > 0 ? (
              <View className="flex-row flex-wrap mb-2">
                {editedTags.map((tag) => (
                  <Pressable
                    key={tag}
                    className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-2 mb-2 flex-row items-center"
                    onPress={() => setEditedTags(editedTags.filter((t) => t !== tag))}
                  >
                    <Text className="text-text-mid text-text12 mr-1">{tag}</Text>
                    <Ionicons name="close" size={11} color={tokens.textLow.hex} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-text-mid text-text13 mb-2">
                No tags. Type above to add one.
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Insights tab — AI analysis of the session (issues, timeline, classification). */
function InsightsTab({ sessionId }: { sessionId: string | undefined }) {
  const { data: insights, isLoading, error, refetch, isRefetching } = useInsights(sessionId);
  const generate = useGenerateInsights(sessionId);
  const { tokens } = useTheme();
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    [],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={tokens.brand.hex} />
        <Text className="text-text-mid text-text14 mt-3">Loading insights…</Text>
      </View>
    );
  }

  // Insights can come back without an `analysis` block until it's generated —
  // treat that the same as "not generated yet".
  if (error || !insights || !insights.analysis) {
    // A 404 means "not generated yet"; anything else is a real error.
    const isRealError = !!error && !/404|not found/i.test(error.message);
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-mid text-text14 text-center mb-4">
          {isRealError
            ? `Could not load insights: ${error.message}`
            : 'No insights generated for this session yet.'}
        </Text>
        {isRealError ? (
          <Pressable
            className="bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={() => refetch()}
          >
            <Text className="text-brand-text text-text14 font-medium">Try again</Text>
          </Pressable>
        ) : (
          <Pressable
            className={`rounded-button px-buttonPrimaryX py-buttonPrimaryY ${generate.isPending ? 'bg-tint-secondary' : 'bg-brand'}`}
            disabled={generate.isPending}
            onPress={() =>
              generate.mutate(undefined, {
                onSuccess: () => {
                  // Poll for results after generation kicks off.
                  refetchTimer.current = setTimeout(() => refetch(), 5000);
                },
              })
            }
          >
            {generate.isPending ? (
              <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
            ) : (
              <Text className="text-text-always-white text-text14 font-medium">
                Generate insights
              </Text>
            )}
          </Pressable>
        )}
        {generate.isSuccess && (
          <View className="flex-row items-center mt-3">
            {isRefetching && <ActivityIndicator size="small" color={tokens.brand.hex} />}
            <Text className="text-text-low text-text12 text-center ml-2">
              Generating… this can take a minute.
            </Text>
          </View>
        )}
      </View>
    );
  }

  const { analysis } = insights;

  return (
    <ScrollView
      className="flex-1 px-4 py-3"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={tokens.brand.hex}
        />
      }
    >
      {/* Classification */}
      <View className="bg-surface1 rounded-card px-4 py-3 mb-3">
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Classification</Text>
        <Text className="text-text-hi text-text14">
          {analysis.classification?.category ?? 'Unclassified'}
        </Text>
        <View className="flex-row mt-2">
          <Text className="text-text-low text-text12">Size: {insights.session_size}</Text>
          <Text className="text-text-low text-text12 ml-3">
            {insights.num_devin_messages} Devin msgs
          </Text>
          <Text className="text-text-low text-text12 ml-3">
            {insights.num_user_messages} user msgs
          </Text>
        </View>
      </View>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <View className="bg-surface1 rounded-card px-4 py-3 mb-3">
          <Text className="text-text-low text-text12 font-medium uppercase mb-2">
            Issues ({analysis.issues.length})
          </Text>
          {analysis.issues.map((issue, i) => (
            <View
              key={i}
              className={`py-2 ${i < analysis.issues.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <View className="flex-row items-center mb-1">
                <View className="rounded-chip px-2 py-0.5 mr-2 bg-tint-orange">
                  <Text className="text-text11 font-medium text-blocked">{issue.label}</Text>
                </View>
                <Text className="text-text-hi text-text13 font-medium flex-1">{issue.issue}</Text>
              </View>
              <Text className="text-text-mid text-text13">{issue.impact}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Suggested actions */}
      {analysis.action_items.length > 0 && (
        <View className="bg-surface1 rounded-card px-4 py-3 mb-3">
          <Text className="text-text-low text-text12 font-medium uppercase mb-2">
            Suggested actions
          </Text>
          {analysis.action_items.map((action, i) => (
            <Text key={i} className="text-text-mid text-text13 py-1">
              {'•'} {action.action_item}
            </Text>
          ))}
        </View>
      )}

      {/* Timeline */}
      {analysis.timeline.length > 0 && (
        <View className="bg-surface1 rounded-card px-4 py-3 mb-3">
          <Text className="text-text-low text-text12 font-medium uppercase mb-2">Timeline</Text>
          {analysis.timeline.map((entry, i) => (
            <View
              key={i}
              className={`py-2 ${i < analysis.timeline.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <Text className="text-text-hi text-text13 font-medium mb-0.5">{entry.title}</Text>
              <Text className="text-text-mid text-text13">{entry.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Prompt suggestions */}
      {analysis.suggested_prompt && (
        <View className="bg-surface1 rounded-card px-4 py-3 mb-3">
          <Text className="text-text-low text-text12 font-medium uppercase mb-2">
            Suggested prompt
          </Text>
          <Text className="text-text-mid text-text13">
            {analysis.suggested_prompt.suggested_prompt}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Timeline tab — Devin desktop chat style: Devin messages as plain text,
 * user messages as right-aligned bubbles. Auto-scrolls only while the user
 * is already near the bottom, so reading history isn't hijacked by polling.
 */
function TimelineTab({
  messages,
  isLoading,
  pendingText,
  isSending,
  isWorking,
}: {
  messages: SessionMessage[];
  isLoading: boolean;
  pendingText: string | null;
  isSending: boolean;
  isWorking: boolean;
}) {
  const listRef = useRef<ScrollView>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    if (nearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, pendingText, isWorking]);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    nearBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
  }

  if (isLoading && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-text-mid text-text14">Loading messages…</Text>
      </View>
    );
  }

  if (messages.length === 0 && !pendingText && !isWorking) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-mid text-text14">No messages yet.</Text>
      </View>
    );
  }

  // A ScrollView (not FlatList) so the echo bubble + working indicator can sit
  // after the mapped messages. Timelines are bounded (paginated to 1k), so the
  // simpler layout is fine and keeps the "live" tail elements trivial.
  return (
    <ScrollView
      ref={listRef}
      className="flex-1 px-4"
      contentContainerClassName="pt-3 pb-[152px]"
      testID="cloud-session-timeline"
      onScroll={handleScroll}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
      }}
    >
      {messages.map((m) => (
        <MessageBubble key={m.event_id} message={m} />
      ))}
      {/* Optimistic echo of the just-sent message (dropped once the real one lands). */}
      {pendingText && (
        <View className="mb-4 max-w-[85%] self-end items-end opacity-70">
          <View className="rounded-2xl px-4 py-3 bg-tint-primary">
            <Text className="text-text14 text-text-hi">{pendingText}</Text>
          </View>
          <Text className="text-text-low text-text11 mt-1 text-right">
            {isSending ? 'Sending…' : 'Sent — waiting for Devin'}
          </Text>
        </View>
      )}
      {/* Live "Devin is working" indicator. */}
      {isWorking && <WorkingIndicator />}
    </ScrollView>
  );
}

function WorkingIndicator() {
  const { tokens } = useTheme();
  return (
    <View className="flex-row items-center mb-4">
      <ActivityIndicator size="small" color={tokens.brandText.hex} />
      <Text className="text-text-mid text-text13 ml-2">Devin is working…</Text>
    </View>
  );
}

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.source === 'user';
  if (isUser) {
    return (
      <View className="mb-4 max-w-[85%] self-end items-end">
        <View className="rounded-2xl px-4 py-3 bg-tint-primary">
          <Text className="text-text14 text-text-hi">{message.message}</Text>
        </View>
        <Text className="text-text-low text-text11 mt-1 text-right">
          {relativeTime(message.created_at)}
        </Text>
      </View>
    );
  }
  // Devin messages render as markdown (code blocks, lists, links).
  return (
    <View className="mb-4">
      <DevinMarkdown>{message.message}</DevinMarkdown>
      <Text className="text-text-low text-text11 mt-1">
        Devin · {relativeTime(message.created_at)}
      </Text>
    </View>
  );
}

/** Worklog tab — shows session metadata, ACU consumption, timeline summary. */
function WorklogTab({ session }: { session: NonNullable<ReturnType<typeof useSession>['data']> }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Status', value: `${session.status} / ${session.status_detail ?? '—'}` },
    { label: 'Created', value: new Date(session.created_at * 1000).toLocaleString() },
    { label: 'Updated', value: new Date(session.updated_at * 1000).toLocaleString() },
    { label: 'ACU consumed', value: String(session.acus_consumed) },
    { label: 'Origin', value: session.origin ?? '—' },
    { label: 'Category', value: session.category ?? '—' },
    { label: 'Playbook', value: session.playbook_id ?? '—' },
    { label: 'Parent session', value: session.parent_session_id ?? '—' },
    { label: 'Service user', value: session.service_user_id ?? '—' },
  ];

  return (
    <ScrollView className="flex-1 px-4 py-3">
      <View className="bg-surface1 rounded-card px-4 py-3 mb-4">
        <Text className="text-text-low text-text12 font-medium uppercase mb-3">Session info</Text>
        {rows.map(({ label, value }, i) => (
          <View
            key={label}
            className={`flex-row py-2 ${i < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}
          >
            <Text className="text-text-mid text-text13 flex-1">{label}</Text>
            <Text className="text-text-hi text-text13 flex-1 text-right">{value}</Text>
          </View>
        ))}
      </View>
      {session.url && (
        <Pressable
          className="bg-surface1 rounded-card px-4 py-3 items-center"
          onPress={() => Linking.openURL(session.url)}
        >
          <Text className="text-link text-text14">Open in Devin web app →</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/** Changes tab — shows PRs associated with the session. */
function ChangesTab({ session }: { session: NonNullable<ReturnType<typeof useSession>['data']> }) {
  const { tokens } = useTheme();
  if (session.pull_requests.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-text-mid text-text14">
          No pull requests associated with this session.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-3">
      {session.pull_requests.map((pr, i) => (
        <Pressable
          key={i}
          className="bg-surface1 rounded-card px-4 py-3 mb-3"
          onPress={() => pr.pr_url && Linking.openURL(pr.pr_url)}
        >
          <View className="flex-row items-center mb-2">
            <View
              className={`flex-row items-center rounded-chip px-pillX py-pillY mr-2 ${pr.state === 'merged' ? 'bg-tint-purple' : 'bg-tint-green'}`}
            >
              <Ionicons
                name={pr.state === 'merged' ? 'git-merge-outline' : 'git-pull-request-outline'}
                size={12}
                color={pr.state === 'merged' ? tokens.merged.hex : tokens.finished.hex}
              />
              <Text
                className={`text-text12 font-medium ml-1 capitalize ${pr.state === 'merged' ? 'text-merged' : 'text-finished'}`}
              >
                {pr.state ?? 'open'}
              </Text>
            </View>
            <Text className="text-text-hi text-text14 font-medium">#{prNumber(pr.pr_url)}</Text>
          </View>
          <Text className="text-text-mid text-text13" numberOfLines={2}>
            {pr.pr_url}
          </Text>
          {pr.merged_at && (
            <Text className="text-text-low text-text12 mt-1">
              Merged {relativeTime(pr.merged_at)}
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
