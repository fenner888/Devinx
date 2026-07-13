import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useComputerSessionAccess,
  useComputerSessionActivity,
  useComputerCreateOptions,
  useComputerSessionDetail,
  usePromptComputerSession,
} from '@api/bridge/queries';
import { ComputerBridgeError, type ComputerLoadedSession } from '@auth/computerBridge';
import { useConnections } from '@auth/ConnectionContext';
import { computerTransportLabel } from '@auth/pairedComputers';
import { DevinMarkdown } from '@components/DevinMarkdown';
import { DevinCompanion } from '@components/pets';
import { ComputerModelPickerSheets } from '@components/sessions/ComputerModelPickerSheets';
import { LiveActivityTrail } from '@components/sessions/LiveActivityTrail';
import {
  VoiceComposerStatus,
  VoiceMicButton,
  useVoiceComposer,
} from '@components/VoiceInput';
import {
  familyForModelId,
  groupComputerModels,
  preferredFamilyVariant,
  splitComputerModelName,
} from '@lib/computer-model-catalog';
import { useTheme } from '@theme/index';
import { activityForComputerSession } from '@/pets/devin/activity';

const BRIDGE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const LOCAL_SESSION_ID_PATTERN = /^local_[A-Za-z0-9_-]{43}$/;
const HISTORY_REFRESH_INTERVAL_MS = 3_000;
const MAXIMUM_HISTORY_REFRESH_ATTEMPTS = 39;

export function devinReplySignature(session: ComputerLoadedSession | undefined): string {
  return JSON.stringify(
    session?.messages.filter((message) => message.source === 'devin').map((message) => message.text) ??
      [],
  );
}

export function hasSettledNewDevinReply(
  baseline: string,
  previouslyObserved: string | null,
  current: string,
): boolean {
  return current !== baseline && current === previouslyObserved;
}

function singleParameter(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function publicErrorMessage(error: unknown): string {
  if (!(error instanceof ComputerBridgeError)) {
    return 'The local session could not be loaded.';
  }
  if (
    error.code === 'not_paired' ||
    error.code === 'permission_denied' ||
    error.code === 'authorization_failed'
  ) {
    return 'This iPhone does not have permission to read that local session.';
  }
  if (error.code === 'invalid_response') {
    return 'The paired Mac returned an incompatible session history.';
  }
  if (error.code === 'rate_limited') {
    return 'The paired Mac is busy. Wait a moment and try again.';
  }
  return 'Open DevinX Connector and confirm the secure computer connection is available.';
}

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

function HistoryMessage({ message }: { message: ComputerLoadedSession['messages'][number] }) {
  const isUser = message.source === 'user';
  if (isUser) {
    return (
      <View className="mb-4 max-w-[88%] self-end items-end">
        <View className="rounded-2xl bg-tint-primary px-4 py-3">
          <Text className="text-text-hi text-text14" selectable>
            {message.text}
          </Text>
        </View>
        <Text className="mt-1 text-text-low text-text11">You</Text>
      </View>
    );
  }
  return (
    <View className="mb-5">
      <DevinMarkdown>{message.text}</DevinMarkdown>
      <Text className="mt-1.5 text-text-low text-text11">Devin</Text>
    </View>
  );
}

export default function ComputerSessionDetailScreen() {
  const parameters = useLocalSearchParams<{
    bridgeId?: string | string[];
    id?: string | string[];
    continuing?: string | string[];
  }>();
  const bridgeId = singleParameter(parameters.bridgeId);
  const sessionId = singleParameter(parameters.id);
  const continuationPending = singleParameter(parameters.continuing) === '1';
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { computers } = useConnections();
  const [companionActive, setCompanionActive] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
  const [draft, setDraft] = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [steeringActive, setSteeringActive] = useState(continuationPending);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const historyRef = useRef<ScrollView>(null);
  const nearBottomRef = useRef(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshGeneration = useRef(0);
  const continuationRefreshStarted = useRef(false);
  const validParameters =
    BRIDGE_ID_PATTERN.test(bridgeId) && LOCAL_SESSION_ID_PATTERN.test(sessionId);
  const computer = computers.find((item) => item.bridgeId === bridgeId);
  const access = useComputerSessionAccess(bridgeId, validParameters && Boolean(computer));
  const mayReadContent = validParameters && Boolean(access.data?.capabilities.sessionLoad);
  const query = useComputerSessionDetail(bridgeId, sessionId, mayReadContent);
  const sessionActivity = useComputerSessionActivity(
    bridgeId,
    sessionId,
    mayReadContent,
  );
  const prompt = usePromptComputerSession(bridgeId, sessionId);
  const canPrompt = Boolean(access.data?.capabilities.sessionPrompt);
  const composerOverlayHeight = canPrompt && mayReadContent ? Math.max(composerHeight, 160) : 0;
  const localOptions = useComputerCreateOptions(bridgeId, canPrompt && Boolean(computer));
  const localModels = useMemo(() => localOptions.data?.models ?? [], [localOptions.data?.models]);
  const modelFamilies = useMemo(() => groupComputerModels(localModels), [localModels]);
  const selectedFamily = familyForModelId(modelFamilies, selectedModelId);
  const selectedVariant = selectedFamily
    ? preferredFamilyVariant(selectedFamily, selectedModelId)
    : undefined;
  const fallbackModel = splitComputerModelName(query.data?.session.model?.name ?? 'Default model');
  const modelLabel = selectedFamily?.name ?? fallbackModel.family;
  const variantLabel = selectedVariant?.label ?? fallbackModel.variant;
  const canChooseModel = localModels.length > 0 && !localOptions.isLoading && !localOptions.error;
  const companionActivity = activityForComputerSession(sessionActivity.data, steeringActive);
  const voice = useVoiceComposer({
    value: draft,
    onChangeText: setDraft,
    disabled: !canPrompt || prompt.isPending || steeringActive,
    hints: {
      repositories: query.data?.session.workspaceName ? [query.data.session.workspaceName] : [],
    },
    scribeContext: {
      destination: computer?.computerName ?? 'Paired computer',
      repository: query.data?.session.workspaceName,
    },
  });

  useEffect(() => {
    if (selectedModelId !== null || localModels.length === 0) return;
    const currentModelId = query.data?.session.model?.id;
    if (currentModelId && localModels.some((model) => model.id === currentModelId)) {
      setSelectedModelId(currentModelId);
    }
  }, [localModels, query.data?.session.model?.id, selectedModelId]);

  useEffect(() => {
    if (!continuationPending || !mayReadContent || continuationRefreshStarted.current) return;
    continuationRefreshStarted.current = true;
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    let previouslyObserved: string | null = null;
    const refreshUntilComplete = async (attempt: number) => {
      const refreshResult = await query.refetch();
      if (refreshGeneration.current !== generation) return;
      const currentReply = refreshResult.data
        ? devinReplySignature(refreshResult.data)
        : '[]';
      if (currentReply !== '[]' && currentReply === previouslyObserved) {
        setSteeringActive(false);
        return;
      }
      previouslyObserved = currentReply === '[]' ? null : currentReply;
      if (attempt >= MAXIMUM_HISTORY_REFRESH_ATTEMPTS) {
        setSteeringActive(false);
        return;
      }
      refreshTimer.current = setTimeout(
        () => refreshUntilComplete(attempt + 1),
        HISTORY_REFRESH_INTERVAL_MS,
      );
    };
    refreshTimer.current = setTimeout(
      () => refreshUntilComplete(0),
      HISTORY_REFRESH_INTERVAL_MS,
    );
  }, [continuationPending, mayReadContent, query]);

  useEffect(
    () => () => {
      refreshGeneration.current += 1;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  function sendPrompt() {
    const text = draft.trim();
    if (!text || !canPrompt || prompt.isPending || steeringActive) return;
    Keyboard.dismiss();
    setSteeringActive(true);
    setPendingText(text);
    setDraft('');
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    const baselineReply = devinReplySignature(query.data);
    const baselineUser = JSON.stringify(
      query.data?.messages
        .filter((message) => message.source === 'user')
        .map((message) => message.text) ?? [],
    );
    prompt.mutate({ text, ...(selectedModelId ? { modelId: selectedModelId } : {}) }, {
      onSuccess: (result) => {
        if (result?.sessionId && result.sessionId !== sessionId) {
          setPendingText(null);
          setSteeringActive(false);
          router.replace(`/computer-session/${bridgeId}/${result.sessionId}?continuing=1`);
          return;
        }
        let observedReply: string | null = null;
        const refreshUntilComplete = async (attempt: number) => {
          const refreshResult = await query.refetch();
          if (refreshGeneration.current !== generation) return;
          if (refreshResult.isSuccess && refreshResult.data) {
            const currentReply = devinReplySignature(refreshResult.data);
            const currentUser = JSON.stringify(
              refreshResult.data.messages
                .filter((message) => message.source === 'user')
                .map((message) => message.text),
            );
            if (currentUser !== baselineUser) setPendingText(null);
            if (hasSettledNewDevinReply(baselineReply, observedReply, currentReply)) {
              setPendingText(null);
              setSteeringActive(false);
              return;
            }
            observedReply = currentReply === baselineReply ? null : currentReply;
          }
          if (attempt >= MAXIMUM_HISTORY_REFRESH_ATTEMPTS) {
            setPendingText(null);
            setSteeringActive(false);
            return;
          }
          refreshTimer.current = setTimeout(
            () => refreshUntilComplete(attempt + 1),
            HISTORY_REFRESH_INTERVAL_MS,
          );
        };
        refreshTimer.current = setTimeout(
          () => refreshUntilComplete(0),
          HISTORY_REFRESH_INTERVAL_MS,
        );
      },
      onError: () => {
        if (refreshGeneration.current === generation) {
          setPendingText(null);
          setDraft(text);
          setSteeringActive(false);
        }
      },
    });
  }

  useEffect(() => {
    if (nearBottomRef.current) historyRef.current?.scrollToEnd({ animated: true });
  }, [pendingText, query.data?.messages.length, steeringActive]);

  function handleHistoryScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    nearBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
  }

  useFocusEffect(
    useCallback(() => {
      setCompanionActive(true);
      return () => setCompanionActive(false);
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center border-b border-border-subtle px-4 py-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 min-w-0">
          <Text className="text-text-hi text-text16" numberOfLines={1}>
            {query.data?.session.workspaceName ?? 'Computer session'}
          </Text>
          <View className="mt-0.5 flex-row items-center">
            <Ionicons name="desktop-outline" size={12} color={tokens.brandText.hex} />
            <Text className="ml-1.5 text-brand-text text-text12" numberOfLines={1}>
              {computer?.computerName ?? 'Paired Mac'}
            </Text>
            <Text className="mx-1.5 text-text-low text-text12">·</Text>
            <Text className="text-text-low text-text12">
              {canPrompt ? 'Steering enabled' : 'Read only'}
            </Text>
            {query.data?.session.model && (
              <>
                <Text className="mx-1.5 text-text-low text-text12">·</Text>
                <Text className="text-text-low text-text12" numberOfLines={1}>
                  {query.data.session.model.name}
                </Text>
              </>
            )}
            {computer && (
              <>
                <Text className="mx-1.5 text-text-low text-text12">·</Text>
                <Text className="text-text-low text-text12">
                  {computerTransportLabel(computer.transportKind)}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Absolute overlays must live inside the flex child KAV shrinks above the keyboard. */}
        <View className="flex-1" testID="computer-session-keyboard-viewport">
        <View className="flex-1">
          {!validParameters || !computer || !mayReadContent ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="lock-closed-outline" size={28} color={tokens.textLow.hex} />
            <Text className="mt-4 text-center text-text-hi text-text16">
              Local history is not available
            </Text>
            <Text className="mt-2 text-center text-text-mid text-text13 leading-5">
              Pair this iPhone with permission to read session content, then open the session again.
            </Text>
          </View>
        ) : query.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={tokens.brand.hex} />
            <Text className="mt-3 text-text-mid text-text13">Loading from your Mac…</Text>
          </View>
        ) : !query.data ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="desktop-outline" size={28} color={tokens.textLow.hex} />
            <Text className="mt-4 text-center text-text-hi text-text16">
              Could not load local history
            </Text>
            <Text className="mt-2 text-center text-text-mid text-text13 leading-5">
              {publicErrorMessage(query.error)}
            </Text>
            <Pressable
              className="mt-5 rounded-card bg-brand px-5 py-3"
              onPress={() => query.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Try loading local session again"
            >
              <Text className="text-text-always-white text-text14 font-medium">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={historyRef}
            className="flex-1"
            contentContainerClassName="px-5 pt-5"
            contentContainerStyle={{ paddingBottom: composerOverlayHeight + 128 }}
            testID="computer-session-history"
            onScroll={handleHistoryScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (nearBottomRef.current) historyRef.current?.scrollToEnd({ animated: false });
            }}
            refreshControl={
              <RefreshControl
                refreshing={query.isRefetching}
                onRefresh={() => query.refetch()}
                tintColor={tokens.brand.hex}
              />
            }
          >
            {query.data.truncated && (
              <View className="mb-5 flex-row items-start rounded-card border border-border-subtle bg-surface1 px-3 py-3">
                <Ionicons name="information-circle-outline" size={16} color={tokens.textMid.hex} />
                <Text className="ml-2 flex-1 text-text-mid text-text12 leading-4">
                  Older content was omitted to keep this private-device transfer small.
                </Text>
              </View>
            )}
            {continuationPending && (
              <View className="mb-5 flex-row items-start rounded-card border border-border-subtle bg-surface1 px-3 py-3">
                <Ionicons name="git-branch-outline" size={16} color={tokens.brandText.hex} />
                <Text className="ml-2 flex-1 text-text-mid text-text12 leading-4">
                  {steeringActive ? 'Continuing' : 'Continued'} in a new computer session while the
                  original remains open in Devin Desktop.
                </Text>
              </View>
            )}
            {query.data.messages.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-text-mid text-text14">No replayable text was returned.</Text>
              </View>
            ) : (
              query.data.messages.map((message) => (
                <HistoryMessage key={message.sequence} message={message} />
              ))
            )}
            {pendingText && (
              <View className="mb-4 max-w-[88%] self-end items-end opacity-70">
                <View className="rounded-2xl bg-tint-primary px-4 py-3">
                  <Text className="text-text-hi text-text14">{pendingText}</Text>
                </View>
                <Text className="mt-1 text-text-low text-text11">Sending…</Text>
              </View>
            )}
            <LiveActivityTrail
              active={steeringActive}
              label={companionActivity.message}
              resetKey={`${bridgeId}:${sessionId}`}
            />
          </ScrollView>
        )}
          {query.data && (
            <View
              pointerEvents="none"
              className="absolute inset-x-0 px-4 pb-1"
              style={{ bottom: composerOverlayHeight }}
              testID="computer-session-companion-dock"
            >
              <DevinCompanion
                state={companionActivity.state}
                size={112}
                message={companionActivity.message}
                active={companionActive}
                travel={companionActivity.travel}
                travelTrack
                accessibilityLabel={`Devin companion, ${companionActivity.message ?? companionActivity.state}`}
              />
            </View>
          )}
        </View>
        {canPrompt && mayReadContent && query.data && (
          <View
            className="absolute inset-x-0 bottom-0 px-4 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom + 8, 16) }}
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
            testID="computer-session-composer-shell"
          >
            {prompt.error && (
              <Text className="mb-2 text-failed text-text12">
                The message could not be sent. Confirm steering is enabled on the Mac.
              </Text>
            )}
            <View
              className="rounded-card border border-border px-3 pt-2 pb-2"
              style={{ backgroundColor: tokens.tintPrimary.hex }}
              testID="computer-session-composer"
            >
              <TextInput
                ref={voice.inputRef}
                className="min-h-[44px] max-h-24 px-1 text-text-hi text-text14"
                value={draft}
                onChangeText={(value) => setDraft(value.slice(0, 100_000))}
                placeholder="Send a message to this Devin session…"
                placeholderTextColor={tokens.textLow.hex}
                multiline
                textAlignVertical="top"
                editable={!prompt.isPending && !steeringActive}
                accessibilityLabel="Computer session message"
                onSelectionChange={voice.onSelectionChange}
              />
              <VoiceComposerStatus voice={voice} />
              <View
                className={`mt-1 flex-row items-center ${voice.isRecording ? 'hidden' : ''}`}
              >
                <Pressable
                  className="mr-1 min-w-0 flex-row items-center rounded-full px-2 py-2"
                  onPress={() => canChooseModel && setShowModelPicker(true)}
                  disabled={!canChooseModel || steeringActive}
                  accessibilityRole="button"
                  accessibilityLabel={`Model: ${modelLabel}`}
                >
                  <Ionicons name="hardware-chip-outline" size={15} color={tokens.textMid.hex} />
                  <Text className="ml-1.5 max-w-24 text-text-mid text-text13" numberOfLines={1}>
                    {modelLabel}
                  </Text>
                  {canChooseModel && (
                    <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                  )}
                </Pressable>
                <Pressable
                  className="min-w-0 flex-row items-center rounded-full px-2 py-2"
                  onPress={() =>
                    selectedFamily &&
                    selectedFamily.variants.length > 1 &&
                    setShowVariantPicker(true)
                  }
                  disabled={
                    !selectedFamily || selectedFamily.variants.length <= 1 || steeringActive
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Reasoning and speed: ${variantLabel}`}
                >
                  <Ionicons name="sparkles-outline" size={14} color={tokens.textMid.hex} />
                  <Text className="ml-1.5 max-w-20 text-text-mid text-text13" numberOfLines={1}>
                    {variantLabel}
                  </Text>
                  {selectedFamily && selectedFamily.variants.length > 1 && (
                    <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                  )}
                </Pressable>
                <View className="ml-auto flex-row items-center gap-1">
                  <VoiceMicButton
                    voice={voice}
                    disabled={!canPrompt || prompt.isPending || steeringActive}
                  />
                  <Pressable
                    className={`h-10 w-10 items-center justify-center rounded-full ${draft.trim() && !prompt.isPending && !steeringActive ? 'bg-brand' : 'bg-tint-secondary'}`}
                    onPress={sendPrompt}
                    disabled={!draft.trim() || prompt.isPending || steeringActive}
                    accessibilityRole="button"
                    accessibilityLabel="Send computer session message"
                  >
                    {prompt.isPending ? (
                      <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                    ) : (
                      <Ionicons
                        name="arrow-up"
                        size={19}
                        color={draft.trim() ? tokens.textAlwaysWhite.hex : tokens.textLow.hex}
                      />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
            <View className="flex-row items-center px-1 pt-2">
              <View className="mr-4 flex-row items-center">
                <Ionicons name="desktop-outline" size={14} color={tokens.textLow.hex} />
                <Text className="ml-1.5 text-text-low text-text12" numberOfLines={1}>
                  {computer?.computerName ?? 'Paired Mac'}
                </Text>
              </View>
              <View
                className="min-w-0 flex-1 flex-row items-center"
                accessibilityLabel={`Workspace: ${query.data.session.workspaceName}`}
              >
                <Ionicons name="folder-outline" size={15} color={tokens.textLow.hex} />
                <Text className="ml-1.5 flex-1 text-text-mid text-text12" numberOfLines={1}>
                  {query.data.session.workspaceName}
                </Text>
              </View>
            </View>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>
      <ComputerModelPickerSheets
        models={localModels}
        selectedModelId={selectedModelId}
        modelVisible={showModelPicker}
        variantVisible={showVariantPicker}
        onSelect={setSelectedModelId}
        onCloseModel={() => setShowModelPicker(false)}
        onCloseVariant={() => setShowVariantPicker(false)}
        catalogSource={localOptions.data?.catalogSource}
      />
    </SafeAreaView>
  );
}
