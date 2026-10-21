import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
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
  useComputerBridgeFeatures,
  type ComputerSessionListItem,
} from '@api/bridge/queries';
import { useComputerGrants } from '@api/bridge/presentation';
import { ComputerBridgeError } from '@auth/computerBridge';
import { OfflineBanner } from '@components/OfflineBanner';
import { NavMenu } from '@components/NavMenu';
import { DevinCompanion, HomeCompanionStage } from '@components/pets';
import { VoiceComposerStatus, VoiceMicButton, useVoiceComposer } from '@components/VoiceInput';
import {
  ComputerDiscoveryNotices,
  ComputerListFreshness,
  ComputerSessionRow,
} from '@components/sessions/ComputerSessionRow';
import { ModelFamilyMark } from '@components/sessions/ModelFamilyMark';
import { ModelCostIndicator, modelCostLabel } from '@components/sessions/ModelCostIndicator';
import { useConnections } from '@auth/ConnectionContext';
import { hapticError, hapticLight, hapticSuccess } from '@lib/haptics';
import {
  familyForModelId,
  groupComputerModels,
  preferredFamilyVariant,
  type ComputerModelFamily,
} from '@lib/computer-model-catalog';
import { branding } from '@lib/branding';
import { useAppPreferences } from '@store/preferences';
import WORDMARK_DARK from '../../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../../assets/wordmark-light.png';

const MAX_PROMPT = 10000;

type Picker = 'computer' | 'workspace' | 'model' | 'variant' | null;

function localOptionsFailureCopy(error: unknown): { title: string; message: string } {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'permission_denied' || code === 'authorization_failed' || code === 'not_paired') {
    return {
      title: 'Connector permission required',
      message: 'Open Otterin Connector locally and enable Create new sessions for this iPhone.',
    };
  }
  return {
    title: 'Local options unavailable',
    message:
      'Otterin Connector could not load workspaces and models. Confirm Connector and Devin for Terminal are ready, then try again.',
  };
}

function HomeRecent({ items }: { items: ComputerSessionListItem[] }) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <View className="mt-8" testID="home-recent">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-text-hi text-text16 font-medium">Recent local sessions</Text>
        <Pressable
          onPress={() => router.push('/(main)/sessions')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="View all local sessions"
        >
          <Text className="text-brand-text text-text13">View all</Text>
        </Pressable>
      </View>
      <View className="gap-2">
        {items.map((session) => (
          <ComputerSessionRow
            key={`${session.bridgeId}:${session.id}`}
            session={session}
            compact
            onPress={
              session.canLoad
                ? () =>
                    router.push({
                      pathname: '/(main)/computer-session/[bridgeId]/[id]',
                      params: { bridgeId: session.bridgeId, id: session.id },
                    })
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { name, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { computers = [], connectionError } = useConnections();
  const computerSessions = useComputerSessions();
  const [selectedComputerBridgeId, setSelectedComputerBridgeId] = useState<string | null>(
    computers[0]?.bridgeId ?? null,
  );
  const computer =
    computers.find((candidate) => candidate.bridgeId === selectedComputerBridgeId) ?? computers[0];
  const computerGrantInfo = useComputerGrants(computer?.bridgeId ?? '', Boolean(computer));
  const localOptions = useComputerCreateOptions(
    computer?.bridgeId ?? '',
    Boolean(computer) &&
      !(computerGrantInfo?.source === 'connector' && computerGrantInfo.grants.startSessions === false),
  );
  const createComputerSession = useCreateComputerSession(computer?.bridgeId ?? '');
  const [prompt, setPrompt] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [companionActive, setCompanionActive] = useState(false);
  const bridgeFeatures = useComputerBridgeFeatures(computer?.bridgeId ?? '', Boolean(computer));
  const setAutoApproveSession = useAppPreferences((state) => state.setAutoApproveSession);

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
    if (selectedModelId !== null && !options.models.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(null);
    }
  }, [localOptions.data, selectedModelId, selectedWorkspaceId]);

  useFocusEffect(
    useCallback(() => {
      setCompanionActive(true);
      return () => setCompanionActive(false);
    }, []),
  );

  const recent = useMemo(
    () =>
      (computerSessions.data?.sessions ?? [])
        .filter((session) => session.bridgeId === computer?.bridgeId)
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? ''),
        )
        .slice(0, 5),
    [computer?.bridgeId, computerSessions.data?.sessions],
  );
  const selectedWorkspace = localOptions.data?.workspaces.find(
    (workspace) => workspace.id === selectedWorkspaceId,
  );
  const localModels = useMemo(() => localOptions.data?.models ?? [], [localOptions.data?.models]);
  const modelFamilies = useMemo(() => groupComputerModels(localModels), [localModels]);
  const selectedFamily = familyForModelId(
    modelFamilies,
    selectedModelId ?? localOptions.data?.defaultModelId,
  );
  const selectedVariant = selectedFamily
    ? preferredFamilyVariant(selectedFamily, selectedModelId ?? localOptions.data?.defaultModelId)
    : undefined;
  const recommendedFamily = modelFamilies.find((family) => family.recommended);
  const recentModelFamilies = modelFamilies.filter(
    (family) => family.recent && family.key !== recommendedFamily?.key,
  );
  const otherModelFamilies = modelFamilies.filter(
    (family) => !family.recent && family.key !== recommendedFamily?.key,
  );
  const normalizedWorkspaceQuery = workspaceQuery.trim().toLocaleLowerCase();
  const workspaces = (localOptions.data?.workspaces ?? []).filter(
    (workspace) =>
      normalizedWorkspaceQuery.length === 0 ||
      workspace.name.toLocaleLowerCase().includes(normalizedWorkspaceQuery),
  );
  const normalizedModelQuery = modelQuery.trim().toLocaleLowerCase();
  const searchedModelFamilies = modelFamilies.filter(
    (family) =>
      family.name.toLocaleLowerCase().includes(normalizedModelQuery) ||
      family.description?.toLocaleLowerCase().includes(normalizedModelQuery) ||
      family.variants.some(
        (variant) =>
          variant.label.toLocaleLowerCase().includes(normalizedModelQuery) ||
          variant.model.name.toLocaleLowerCase().includes(normalizedModelQuery),
      ),
  );
  const localDiscoveryState = computerSessions.data?.computers.find(
    (candidate) => candidate.bridgeId === computer?.bridgeId,
  )?.state;
  const localIsReady = Boolean(computer) && localDiscoveryState === 'ready';
  const readOnlyLocalHome =
    computerGrantInfo?.source === 'connector' &&
    computerGrantInfo.grants.startSessions === false;
  const canUseComposer = Boolean(
    computer && selectedWorkspaceId && !localOptions.isLoading && !localOptions.error && !readOnlyLocalHome,
  );
  const composerPending = createComputerSession.isPending;
  const composerState = composerError ? 'error' : composerPending ? 'working' : 'idle';
  const companionSize = Math.round(Math.min(height < 700 ? 184 : 220, Math.max(164, width * 0.54)));
  const voice = useVoiceComposer({
    value: prompt,
    onChangeText: setPrompt,
    disabled: !canUseComposer || composerPending,
    maximumLength: MAX_PROMPT,
    hints: {
      repositories: localOptions.data?.workspaces.map((workspace) => workspace.name) ?? [],
      playbooks: [],
      tags: [],
    },
    scribeContext: {
      destination: computer?.computerName ?? 'Local',
      repository: selectedWorkspace?.name,
    },
  });

  function openLocalPicker(kind: 'workspace' | 'model') {
    if (localOptions.isLoading) {
      Alert.alert('Loading local options', 'Otterin is checking the approved options on your Mac.');
      return;
    }
    if (!localOptions.data) {
      const failure = localOptionsFailureCopy(localOptions.error);
      Alert.alert(failure.title, failure.message);
      return;
    }
    if (kind === 'workspace') {
      if (localOptions.data.workspaces.length === 0) {
        Alert.alert(
          'No local workspaces yet',
          'Start or resume a Devin session in a workspace on your Mac, then try again.',
        );
        return;
      }
      setWorkspaceQuery('');
    } else {
      setModelQuery('');
    }
    setPicker(kind);
  }

  function modelFamilyRow(family: ComputerModelFamily) {
    const defaultVariant =
      family.variants.find((variant) => variant.model.recommended) ?? family.variants[0];
    if (!defaultVariant) return null;
    const selected = family.key === selectedFamily?.key;
    const costLabel = modelCostLabel(defaultVariant.model.costTier, defaultVariant.model.costSummary);
    return (
      <Pressable
        key={family.key}
        className="min-h-16 flex-row items-center px-2 py-3"
        onPress={() => {
          setSelectedModelId(defaultVariant.model.recommended ? null : defaultVariant.model.id);
          setPicker(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Use ${family.name}${costLabel ? `, ${costLabel}` : ''}`}
        accessibilityState={{ selected }}
      >
        <View className="w-8 items-start">
          {selected && <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />}
        </View>
        <ModelFamilyMark name={family.name} size={23} />
        <View className="flex-1 ml-3">
          <Text className="text-text-hi text-text15" numberOfLines={1}>
            {family.name}
          </Text>
          <Text className="mt-0.5 text-text-low text-text12" numberOfLines={1}>
            {family.recommended ? 'Recommended' : family.recent ? 'Recent' : 'Available model'}
          </Text>
        </View>
        {defaultVariant.model.supportsImages && (
          <Ionicons name="image-outline" size={15} color={tokens.textLow.hex} />
        )}
        <View className="ml-2">
          <ModelCostIndicator
            costTier={defaultVariant.model.costTier}
            costSummary={defaultVariant.model.costSummary}
          />
        </View>
      </Pressable>
    );
  }

  function toggleAutoApprove() {
    if (autoApproveEnabled) {
      setAutoApproveEnabled(false);
      return;
    }
    Alert.alert(
      'Auto-approve commands?',
      "Devin will run commands and edit files in this folder without asking you first. Your organization's rules still apply. Takes effect from your next message.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn on', onPress: () => setAutoApproveEnabled(true) },
      ],
    );
  }

  function handleSend() {
    if (!computer || !selectedWorkspaceId || !prompt.trim() || createComputerSession.isPending) {
      return;
    }
    hapticLight();
    setComposerError(null);
    createComputerSession.mutate(
      {
        workspaceId: selectedWorkspaceId,
        modelId: selectedModelId ?? localOptions.data?.defaultModelId ?? null,
        text: prompt.trim().slice(0, MAX_PROMPT),
        ...(bridgeFeatures.data?.autoApprove === true ? { autoApprove: autoApproveEnabled } : {}),
      },
      {
        onSuccess: ({ sessionId }) => {
          hapticSuccess();
          if (autoApproveEnabled) {
            setAutoApproveSession(computer.bridgeId, sessionId, true);
          }
          setPrompt('');
          router.push(`/computer-session/${computer.bridgeId}/${sessionId}?continuing=1`);
        },
        onError: (error) => {
          hapticError();
          setComposerError(
            error instanceof ComputerBridgeError && error.code === 'auto_approve_unavailable'
              ? "Auto-approve isn't allowed on this Mac (organization policy). Your message wasn't sent."
              : error instanceof Error
                ? error.message
                : 'The local session could not be created.',
          );
        },
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
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
            accessibilityLabel={branding.name}
          />
        </View>
        <View className="w-10 h-10 items-center justify-center" accessible={false}>
          <Ionicons name="desktop-outline" size={23} color={tokens.textMid.hex} />
        </View>
      </View>
      <NavMenu visible={showMenu} onClose={() => setShowMenu(false)} />
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
          <View className="items-center pt-1 pb-2">
            <View className="flex-row items-center">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${localIsReady ? 'bg-finished' : 'bg-text-low'}`}
              />
              <Text className="text-text-low text-text11 font-medium uppercase tracking-widest">
                {localIsReady ? 'Local ready' : computer ? 'Checking your Mac' : 'Pair a Mac to begin'}
              </Text>
            </View>
            {connectionError ? (
              <Text className="mt-1 text-failed text-text12 text-center">{connectionError}</Text>
            ) : computer ? (
              <Text className="mt-1 text-text-low text-text12">{computer.computerName}</Text>
            ) : (
              <Pressable
                className="mt-1"
                onPress={() => router.push('/(main)/computer')}
                accessibilityRole="button"
                accessibilityLabel="Pair a Mac"
              >
                <Text className="text-brand-text text-text12">Pair your Mac in Your Mac settings</Text>
              </Pressable>
            )}
          </View>

          <HomeCompanionStage companionSize={companionSize}>
            <DevinCompanion
              state={composerState}
              size={companionSize}
              active={companionActive}
              accessibilityLabel={`${branding.name} companion, ${composerState}`}
            />
          </HomeCompanionStage>

          {readOnlyLocalHome ? (
            <Pressable
              className="mt-3 flex-row items-center rounded-card border border-border-subtle bg-surface1 px-4 py-3"
              onPress={() => router.push('/(main)/computer')}
              testID="home-read-only-card"
              accessibilityRole="button"
            >
              <Ionicons name="lock-closed-outline" size={18} color={tokens.textMid.hex} />
              <Text className="mx-3 flex-1 text-text-mid text-text13 leading-5">
                {`This device can view sessions but can't start them — change permissions in Otterin Connector on ${computer?.computerName ?? 'your Mac'}`}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={tokens.textLow.hex} />
            </Pressable>
          ) : (
            <>
              <Text
                className="mb-3 text-text-hi text-text17 font-medium"
                testID="home-composer-heading"
              >
                What should Devin build?
              </Text>
              <View className="rounded-cardLg border border-border bg-surface1">
                <TextInput
                  ref={voice.inputRef}
                  className="min-h-[84px] max-h-40 px-5 pt-4 pb-2 text-text-hi text-text16"
                  value={prompt}
                  onChangeText={(value) => setPrompt(value.slice(0, MAX_PROMPT))}
                  editable={canUseComposer}
                  placeholder="Ask Devin locally to build, fix, or investigate…"
                  placeholderTextColor={tokens.textLow.hex}
                  multiline
                  maxLength={MAX_PROMPT}
                  autoCapitalize="sentences"
                  autoCorrect
                  textAlignVertical="top"
                  accessibilityLabel="Session prompt"
                  onSelectionChange={voice.onSelectionChange}
                />
                <VoiceComposerStatus voice={voice} />
                <View
                  className={`flex-row items-center justify-between px-4 pb-4 ${voice.isRecording ? 'hidden' : ''}`}
                >
                  <View className="flex-row items-center gap-1">
                    <Pressable
                      className="flex-row items-center rounded-full px-3 py-2"
                      onPress={() => openLocalPicker('model')}
                      accessibilityRole="button"
                      accessibilityLabel={`Model: ${selectedFamily?.name ?? 'Default'}`}
                    >
                      <ModelFamilyMark name={selectedFamily?.name ?? 'Default model'} size={17} />
                      <Text className="text-text-mid text-text13 ml-1.5 max-w-28" numberOfLines={1}>
                        {selectedFamily?.name ?? 'Default model'}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                    </Pressable>
                    {selectedFamily && selectedFamily.variants.length > 1 && selectedVariant && (
                      <Pressable
                        className="flex-row items-center rounded-full px-2 py-2"
                        onPress={() => setPicker('variant')}
                        accessibilityRole="button"
                        accessibilityLabel={`Reasoning and speed: ${selectedVariant.label}`}
                      >
                        <Ionicons name="sparkles-outline" size={14} color={tokens.textMid.hex} />
                        <Text className="ml-1.5 max-w-20 text-text-mid text-text13" numberOfLines={1}>
                          {selectedVariant.label}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                      </Pressable>
                    )}
                  </View>
                  <View className="flex-row items-center gap-1">
                    {bridgeFeatures.data?.autoApprove === true && (
                      <Pressable
                        className="h-10 w-10 items-center justify-center rounded-full"
                        onPress={toggleAutoApprove}
                        accessibilityRole="button"
                        accessibilityLabel={
                          autoApproveEnabled ? 'Auto-approve on' : 'Auto-approve off'
                        }
                      >
                        <Ionicons
                          name={autoApproveEnabled ? 'shield-checkmark' : 'shield-outline'}
                          size={19}
                          color={autoApproveEnabled ? tokens.brand.hex : tokens.textMid.hex}
                        />
                      </Pressable>
                    )}
                    <VoiceMicButton voice={voice} disabled={!canUseComposer || composerPending} />
                    <Pressable
                      className={`w-10 h-10 rounded-full items-center justify-center ${canUseComposer && prompt.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
                      onPress={handleSend}
                      disabled={!canUseComposer || !prompt.trim() || composerPending}
                      accessibilityRole="button"
                      accessibilityLabel="Start local session"
                    >
                      {composerPending ? (
                        <ActivityIndicator color={tokens.textAlwaysWhite.hex} size="small" />
                      ) : (
                        <Ionicons
                          name="arrow-up"
                          size={20}
                          color={
                            canUseComposer && prompt.trim()
                              ? tokens.textAlwaysWhite.hex
                              : tokens.textLow.hex
                          }
                        />
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>

              <View
                className={`flex-row items-center px-2 pt-2 gap-4 ${voice.isRecording ? 'hidden' : ''}`}
              >
                <Pressable
                  className="flex-row items-center"
                  onPress={() => computers.length > 1 && setPicker('computer')}
                  disabled={computers.length <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Mac: ${computer?.computerName ?? 'Select Mac'}`}
                >
                  <Ionicons name="desktop-outline" size={14} color={tokens.textLow.hex} />
                  <Text className="text-text-mid text-text12 ml-1.5" numberOfLines={1}>
                    {computer?.computerName ?? 'Select Mac'}
                  </Text>
                  {computers.length > 1 && (
                    <Ionicons name="chevron-down" size={12} color={tokens.textLow.hex} />
                  )}
                </Pressable>
                <Pressable
                  className="flex-row items-center flex-1 min-w-0"
                  onPress={() => openLocalPicker('workspace')}
                  accessibilityRole="button"
                  accessibilityLabel={`Workspace: ${selectedWorkspace?.name ?? 'Unavailable'}`}
                >
                  <Ionicons name="folder-outline" size={15} color={tokens.textLow.hex} />
                  <Text className="text-text-mid text-text12 ml-1.5 flex-1" numberOfLines={1}>
                    {selectedWorkspace?.name ?? 'Select workspace'}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={tokens.textLow.hex} />
                </Pressable>
              </View>
              {localOptions.error && (
                <Text className="px-2 pt-2 text-failed text-text12">
                  {localOptionsFailureCopy(localOptions.error).message}
                </Text>
              )}
              {composerError && (
                <View className="flex-row items-center bg-tint-red rounded-card px-3 py-2 mt-3">
                  <Ionicons name="alert-circle-outline" size={14} color={tokens.failed.hex} />
                  <Text className="text-failed text-text12 ml-2 flex-1">{composerError}</Text>
                </View>
              )}
            </>
          )}

          <View className="mt-3">
            <ComputerDiscoveryNotices computers={computerSessions.data?.computers ?? []} />
            <ComputerListFreshness lastSuccessfulAt={computerSessions.data?.lastSuccessfulAt} />
          </View>
          <HomeRecent items={recent} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        statusBarTranslucent
        visible={picker !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPicker(null)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="rounded-t-sheet bg-surface2 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16), maxHeight: Math.min(height * 0.82, 680) }}
            accessibilityViewIsModal
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-border" />
            <View className="mb-3 flex-row items-center justify-between px-5">
              <View className="flex-1 pr-3">
                <Text className="text-text-hi text-text17 font-medium">
                  {picker === 'computer'
                    ? 'Choose a Mac'
                    : picker === 'workspace'
                      ? 'Choose a workspace'
                      : picker === 'model'
                        ? 'Choose a model'
                        : selectedFamily?.name ?? 'Choose a model variant'}
                </Text>
                <Text className="mt-1 text-text-low text-text12">
                  {picker === 'computer'
                    ? 'Select a paired Mac for this session'
                    : picker === 'workspace'
                      ? 'Choose a workspace approved in Devin for Terminal'
                      : picker === 'model'
                        ? 'Models available on your Mac'
                        : 'Choose a reasoning and speed option'}
                </Text>
              </View>
              {picker === 'model' && (
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-full"
                  onPress={() => localOptions.refreshCatalog().catch(() => undefined)}
                  disabled={localOptions.isRefreshingCatalog}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh models from Devin"
                >
                  {localOptions.isRefreshingCatalog ? (
                    <ActivityIndicator size="small" color={tokens.brandText.hex} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={tokens.brandText.hex} />
                  )}
                </Pressable>
              )}
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-tint-secondary"
                onPress={() => setPicker(null)}
                accessibilityRole="button"
                accessibilityLabel="Close picker"
              >
                <Ionicons name="close" size={19} color={tokens.textMid.hex} />
              </Pressable>
            </View>

            {(picker === 'workspace' || picker === 'model') && (
              <View className="mx-5 mb-3 flex-row items-center rounded-input border border-border-subtle bg-surface1 px-3">
                <Ionicons name="search" size={16} color={tokens.textLow.hex} />
                <TextInput
                  className="ml-2 min-h-11 flex-1 text-text14 text-text-hi"
                  value={picker === 'workspace' ? workspaceQuery : modelQuery}
                  onChangeText={picker === 'workspace' ? setWorkspaceQuery : setModelQuery}
                  placeholder={picker === 'workspace' ? 'Search workspaces' : 'Search models'}
                  placeholderTextColor={tokens.textLow.hex}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={picker === 'workspace' ? 'Search workspaces' : 'Search models'}
                />
              </View>
            )}

            <ScrollView
              className="px-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {picker === 'computer' &&
                computers.map((computerOption, index) => {
                  const selected = computerOption.bridgeId === computer?.bridgeId;
                  return (
                    <Pressable
                      key={computerOption.bridgeId}
                      className={`min-h-16 flex-row items-center px-2 py-3 ${index < computers.length - 1 ? 'border-b border-border-subtle' : ''}`}
                      onPress={() => {
                        setSelectedComputerBridgeId(computerOption.bridgeId);
                        setSelectedWorkspaceId(null);
                        setSelectedModelId(null);
                        setPicker(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${computerOption.computerName}`}
                      accessibilityState={{ selected }}
                    >
                      <Ionicons name="desktop-outline" size={19} color={tokens.textMid.hex} />
                      <Text className="flex-1 ml-3 text-text-hi text-text14">
                        {computerOption.computerName}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark" size={21} color={tokens.brandText.hex} />
                      )}
                    </Pressable>
                  );
                })}

              {picker === 'workspace' &&
                workspaces.map((workspace) => {
                  const selected = workspace.id === selectedWorkspaceId;
                  return (
                    <Pressable
                      key={workspace.id}
                      className="min-h-14 flex-row items-center px-2 py-3 border-b border-border-subtle"
                      onPress={() => {
                        setSelectedWorkspaceId(workspace.id);
                        setPicker(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Use workspace ${workspace.name}`}
                      accessibilityState={{ selected }}
                    >
                      <View className="w-8 items-start">
                        {selected && (
                          <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-text-hi text-text14" numberOfLines={1}>
                          {workspace.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

              {picker === 'model' &&
                (normalizedModelQuery
                  ? searchedModelFamilies.map((family) => modelFamilyRow(family))
                  : (
                      <>
                        <Text className="px-10 pb-2 pt-1 text-text-low text-text13 font-medium">
                          Recommended
                        </Text>
                        {recommendedFamily ? (
                          modelFamilyRow(recommendedFamily)
                        ) : (
                          <Pressable
                            className="min-h-14 flex-row items-center px-2 py-3"
                            onPress={() => {
                              setSelectedModelId(null);
                              setPicker(null);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Use Devin default model"
                          >
                            <View className="w-8 items-start">
                              {selectedModelId === null && (
                                <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />
                              )}
                            </View>
                            <View className="flex-1">
                              <Text className="text-text-hi text-text16">Default model</Text>
                              <Text className="mt-0.5 text-text-low text-text12">
                                Let Devin choose the recommended model
                              </Text>
                            </View>
                          </Pressable>
                        )}
                        {recentModelFamilies.length > 0 && (
                          <>
                            <View className="my-2 h-px bg-border-subtle" />
                            <Text className="px-10 pb-2 pt-2 text-text-low text-text13 font-medium">
                              Recent
                            </Text>
                            {recentModelFamilies.map((family) => modelFamilyRow(family))}
                          </>
                        )}
                        {otherModelFamilies.length > 0 && (
                          <>
                            <View className="my-2 h-px bg-border-subtle" />
                            <Text className="px-10 pb-2 pt-2 text-text-low text-text13 font-medium">
                              All Models
                            </Text>
                            {otherModelFamilies.map((family) => modelFamilyRow(family))}
                          </>
                        )}
                        {localOptions.data?.catalogSource === 'recent' && (
                          <Text className="px-10 pb-3 pt-4 text-text-low text-text11">
                            Showing recent models. Refresh to load the full catalog from Devin.
                          </Text>
                        )}
                      </>
                    ))}

              {picker === 'variant' &&
                selectedFamily?.variants.map((variant) => {
                  const selected = variant.model.id === selectedVariant?.model.id;
                  const costLabel = modelCostLabel(variant.model.costTier, variant.model.costSummary);
                  return (
                    <Pressable
                      key={variant.model.id}
                      className="min-h-14 flex-row items-center px-2 py-3"
                      onPress={() => {
                        setSelectedModelId(variant.model.recommended ? null : variant.model.id);
                        setPicker(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${variant.label} for ${selectedFamily.name}${costLabel ? `, ${costLabel}` : ''}`}
                      accessibilityState={{ selected }}
                    >
                      <View className="w-8 items-start">
                        {selected && (
                          <Ionicons name="checkmark" size={21} color={tokens.textHi.hex} />
                        )}
                      </View>
                      <Text className="flex-1 text-text-hi text-text16">{variant.label}</Text>
                      {variant.model.supportsImages && (
                        <Ionicons name="image-outline" size={15} color={tokens.textLow.hex} />
                      )}
                      <View className="ml-2">
                        <ModelCostIndicator
                          costTier={variant.model.costTier}
                          costSummary={variant.model.costSummary}
                        />
                      </View>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
