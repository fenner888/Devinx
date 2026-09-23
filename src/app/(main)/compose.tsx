/**
 * Compose screen — spec §7.4.
 * Prompt textarea, optional title, documented session settings, resource
 * pickers, tag input, submit → createSession → session detail.
 * Draft persistence via AsyncStorage.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useCreateSession,
  usePlaybooks,
  useKnowledge,
  useSecrets,
  useUploadAttachment,
  useRepositories,
} from '@api/devin/queries';
import { ModeSettings } from '@components/ModeSettings';
import { AttachmentPickerSheet, type PickedAttachment } from '@components/AttachmentPickerSheet';
import { VoiceComposerStatus, VoiceMicButton, useVoiceComposer } from '@components/VoiceInput';
import type { DevinMode, SessionSecretInput } from '@api/devin/types';
import { useTheme } from '@theme/index';
import { rememberSessionMode, rememberSessionRepository } from '@lib/session-repository';
import { COMPOSE_DRAFT_KEY } from '@lib/localUserData';
import { useAppPreferences, type CloudLaunchProfile } from '@store/preferences';
import { userFacingError } from '@lib/user-facing-error';
import { repositoryIndexPresentation } from '@lib/repository-indexing';
import { reconcileCloudResourceSelection } from '@lib/launch-profile';
import {
  normalizeSessionSecrets,
  parseSessionLinks,
  parseStructuredOutputSchema,
} from '@lib/session-create-options';

const MAX_PROMPT = 10000;
const MAX_TITLE = 200;

interface Draft {
  prompt: string;
  title: string;
  repos: string[];
  playbookId: string | null;
  knowledgeIds: string[];
  secretIds: string[];
  mode: DevinMode;
  tags: string[];
  maxAcuLimit: string;
  platform: string;
  resumable: boolean;
  sessionLinks: string;
  structuredOutputRequired: boolean;
  structuredOutputSchema: string;
}

interface TransientSessionSecret extends SessionSecretInput {
  id: number;
}

const emptyDraft: Draft = {
  prompt: '',
  title: '',
  repos: [],
  playbookId: null,
  knowledgeIds: [],
  secretIds: [],
  mode: 'normal',
  tags: [],
  maxAcuLimit: '',
  platform: '',
  resumable: true,
  sessionLinks: '',
  structuredOutputRequired: true,
  structuredOutputSchema: '',
};

export default function ComposeScreen() {
  const router = useRouter();
  const createSession = useCreateSession();
  const playbooksQuery = usePlaybooks();
  const knowledgeQuery = useKnowledge();
  const secretsQuery = useSecrets();
  const repositoriesQuery = useRepositories();
  const { data: playbooks, isLoading: playbooksLoading } = playbooksQuery;
  const { data: knowledge } = knowledgeQuery;
  const { data: secrets } = secretsQuery;
  const { data: repositories } = repositoriesQuery;
  const uploadAttachment = useUploadAttachment();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const defaultTags = useAppPreferences((state) => state.defaultTags);
  const launchProfiles = useAppPreferences((state) => state.launchProfiles);
  const activeLaunchProfileId = useAppPreferences((state) => state.activeLaunchProfileId);
  const upsertLaunchProfile = useAppPreferences((state) => state.upsertLaunchProfile);
  const setActiveLaunchProfile = useAppPreferences((state) => state.setActiveLaunchProfile);
  const activeLaunchProfile =
    launchProfiles.find((profile) => profile.id === activeLaunchProfileId) ?? null;

  const [attachments, setAttachments] = useState<
    { name: string; url: string; previewUri?: string }[]
  >([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [showSecretsPicker, setShowSecretsPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagInput, setTagInput] = useState('');
  // Session-secret values deliberately never enter the persisted Draft. They
  // exist in component memory only and disappear on success or unmount.
  const [sessionSecrets, setSessionSecrets] = useState<TransientSessionSecret[]>([]);
  const sessionSecretSequence = useRef(0);
  const defaultTagsRef = useRef(defaultTags);
  const activeLaunchProfileRef = useRef(activeLaunchProfile);

  useEffect(() => {
    activeLaunchProfileRef.current = activeLaunchProfile;
  }, [activeLaunchProfile]);

  // Load draft from AsyncStorage on mount.
  useEffect(() => {
    AsyncStorage.getItem(COMPOSE_DRAFT_KEY)
      .then((json) => {
        if (json) {
          try {
            setDraft({ ...emptyDraft, tags: defaultTagsRef.current, ...JSON.parse(json) });
          } catch {
            // ignore corrupt draft
          }
        } else {
          const profile = activeLaunchProfileRef.current;
          setDraft(
            profile
              ? {
                  ...emptyDraft,
                  repos: profile.repositoryPaths,
                  playbookId: profile.playbookId ?? null,
                  knowledgeIds: profile.knowledgeIds,
                  secretIds: profile.secretIds,
                  mode: profile.mode,
                  tags: profile.tags,
                  maxAcuLimit: profile.maxAcuLimit ? String(profile.maxAcuLimit) : '',
                }
              : { ...emptyDraft, tags: defaultTagsRef.current },
          );
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  // Persist draft on change (debounced via useEffect).
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      AsyncStorage.setItem(COMPOSE_DRAFT_KEY, JSON.stringify(draft)).catch(() => {
        // ignore storage errors
      });
    }, 500);
    return () => clearTimeout(id);
  }, [draft, loaded]);

  // A device-local profile can outlive the Cloud resources it references.
  // Reconcile only after each corresponding catalog has loaded successfully;
  // a pending or failed request must never erase a valid selection.
  useEffect(() => {
    if (!loaded) return;
    setDraft((current) => {
      const reconciled = reconcileCloudResourceSelection(current, {
        repositoryPaths: repositoriesQuery.isSuccess
          ? (repositories ?? []).map((repository) => repository.repo_path)
          : undefined,
        playbookIds: playbooksQuery.isSuccess
          ? (playbooks ?? []).map((playbook) => playbook.playbook_id)
          : undefined,
        knowledgeIds: knowledgeQuery.isSuccess
          ? (knowledge ?? []).map((note) => note.note_id)
          : undefined,
        secretIds: secretsQuery.isSuccess
          ? (secrets ?? []).map((secret) => secret.secret_id)
          : undefined,
      });
      if (
        reconciled.playbookId === current.playbookId &&
        reconciled.repos.length === current.repos.length &&
        reconciled.knowledgeIds.length === current.knowledgeIds.length &&
        reconciled.secretIds.length === current.secretIds.length
      ) {
        return current;
      }
      return { ...current, ...reconciled };
    });
  }, [
    knowledge,
    knowledgeQuery.isSuccess,
    loaded,
    playbooks,
    playbooksQuery.isSuccess,
    repositories,
    repositoriesQuery.isSuccess,
    secrets,
    secretsQuery.isSuccess,
  ]);

  const canSubmit =
    draft.prompt.trim().length > 0 && !createSession.isPending && !uploadAttachment.isPending;

  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);
  const updatePrompt = useCallback((prompt: string) => {
    setDraft((current) => ({ ...current, prompt }));
  }, []);
  const voice = useVoiceComposer({
    value: draft.prompt,
    onChangeText: updatePrompt,
    disabled: !loaded || createSession.isPending,
    maximumLength: MAX_PROMPT,
    hints: {
      repositories: (repositories ?? []).map((repository) => repository.repo_name),
      playbooks: (playbooks ?? []).map((playbook) => playbook.title),
      tags: draft.tags,
    },
    scribeContext: {
      destination: 'Devin Cloud',
      repository: draft.repos.join(', ') || undefined,
    },
  });

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !draft.tags.includes(tag) && draft.tags.length < 50) {
      updateDraft({ tags: [...draft.tags, tag] });
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    updateDraft({ tags: draft.tags.filter((t) => t !== tag) });
  }

  function toggleKnowledge(id: string) {
    if (draft.knowledgeIds.includes(id)) {
      updateDraft({ knowledgeIds: draft.knowledgeIds.filter((k) => k !== id) });
    } else {
      updateDraft({ knowledgeIds: [...draft.knowledgeIds, id] });
    }
  }

  function toggleSecret(id: string) {
    if (draft.secretIds.includes(id)) {
      updateDraft({ secretIds: draft.secretIds.filter((s) => s !== id) });
    } else {
      updateDraft({ secretIds: [...draft.secretIds, id] });
    }
  }

  async function handleAttachment(file: PickedAttachment) {
    try {
      const uploaded = await uploadAttachment.mutateAsync(file);
      setAttachments((prev) => [
        ...prev,
        {
          name: uploaded.name,
          url: uploaded.url,
          previewUri: file.type.startsWith('image/') ? file.uri : undefined,
        },
      ]);
    } catch (e) {
      Alert.alert('Upload failed', userFacingError(e, 'Could not upload this attachment.'));
    }
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  function addSessionSecret() {
    sessionSecretSequence.current += 1;
    setSessionSecrets((current) => [
      ...current,
      { id: sessionSecretSequence.current, key: '', value: '', sensitive: true },
    ]);
  }

  function updateSessionSecret(id: number, patch: Partial<SessionSecretInput>) {
    setSessionSecrets((current) =>
      current.map((secret) => (secret.id === id ? { ...secret, ...patch } : secret)),
    );
  }

  function removeSessionSecret(id: number) {
    setSessionSecrets((current) => current.filter((secret) => secret.id !== id));
  }

  function saveLaunchProfile() {
    const name = profileName.trim().slice(0, 80);
    if (!name) return;
    const now = Date.now();
    const acuLimit = Number(draft.maxAcuLimit);
    const profile: CloudLaunchProfile = {
      id: `cloud-${now.toString(36)}-${launchProfiles.length}`,
      name,
      target: 'cloud',
      repositoryPaths: draft.repos,
      mode: draft.mode,
      playbookId: draft.playbookId ?? undefined,
      knowledgeIds: draft.knowledgeIds,
      secretIds: draft.secretIds,
      tags: draft.tags,
      maxAcuLimit: Number.isInteger(acuLimit) && acuLimit > 0 ? acuLimit : undefined,
      createdAt: now,
      updatedAt: now,
    };
    upsertLaunchProfile(profile);
    setActiveLaunchProfile(profile.id);
    setProfileName('');
    setShowSaveProfile(false);
  }

  async function handleSubmit() {
    if (!draft.prompt.trim()) return;
    try {
      const acuLimit = Number(draft.maxAcuLimit);
      const structuredOutputSchema = parseStructuredOutputSchema(draft.structuredOutputSchema);
      const transientSecrets = normalizeSessionSecrets(sessionSecrets);
      const session = await createSession.mutateAsync({
        prompt: draft.prompt.trim(),
        title: draft.title.trim() || undefined,
        repos: draft.repos.length > 0 ? draft.repos : undefined,
        playbook_id: draft.playbookId ?? undefined,
        knowledge_ids: draft.knowledgeIds.length > 0 ? draft.knowledgeIds : undefined,
        secret_ids: draft.secretIds.length > 0 ? draft.secretIds : undefined,
        devin_mode: draft.mode,
        tags: draft.tags.length > 0 ? draft.tags : undefined,
        max_acu_limit: Number.isInteger(acuLimit) && acuLimit > 0 ? acuLimit : undefined,
        attachment_urls: attachments.length > 0 ? attachments.map((a) => a.url) : undefined,
        platform: draft.platform.trim() || undefined,
        resumable: draft.resumable,
        session_links: parseSessionLinks(draft.sessionLinks),
        session_secrets: transientSecrets,
        structured_output_schema: structuredOutputSchema,
        structured_output_required: structuredOutputSchema
          ? draft.structuredOutputRequired
          : undefined,
      });
      await Promise.all([
        rememberSessionRepository(session.session_id, draft.repos[0]),
        rememberSessionMode(session.session_id, draft.mode),
      ]);
      // Clear draft on success.
      await AsyncStorage.removeItem(COMPOSE_DRAFT_KEY);
      setDraft(emptyDraft);
      setSessionSecrets([]);
      router.replace(`/(main)/session/${session.session_id}`);
    } catch (e) {
      Alert.alert('Could not create session', userFacingError(e, 'Could not create this session.'));
    }
  }

  if (!loaded) {
    return (
      <SafeAreaView className="flex-1 bg-surface0 items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={tokens.brand.hex} />
      </SafeAreaView>
    );
  }

  const selectedPlaybook = playbooks?.find((p) => p.playbook_id === draft.playbookId);
  const selectedKnowledge = knowledge?.filter((k) => draft.knowledgeIds.includes(k.note_id)) ?? [];
  const selectedSecrets = secrets?.filter((s) => draft.secretIds.includes(s.secret_id)) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border-subtle">
          <Pressable
            className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={17} color={tokens.textMid.hex} />
          </Pressable>
          <Text className="text-text-hi text-text17">New Session</Text>
          <View className="w-9" />
        </View>

        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          {/* Title (optional) */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1">
            Title (optional)
          </Text>
          <TextInput
            className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-4"
            value={draft.title}
            onChangeText={(v) => updateDraft({ title: v.slice(0, MAX_TITLE) })}
            placeholder="Give your session a name…"
            placeholderTextColor={tokens.textLow.hex}
            maxLength={MAX_TITLE}
          />

          {/* Prompt */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1">
            Prompt {'\u2022'} {draft.prompt.length}/{MAX_PROMPT}
          </Text>
          <TextInput
            ref={voice.inputRef}
            className="bg-surface1 rounded-input px-3 py-3 text-text14 text-text-hi mb-1 min-h-32"
            value={draft.prompt}
            onChangeText={(v) => updateDraft({ prompt: v.slice(0, MAX_PROMPT) })}
            placeholder="Describe what you want Devin to do…"
            placeholderTextColor={tokens.textLow.hex}
            multiline
            textAlignVertical="top"
            maxLength={MAX_PROMPT}
            onSelectionChange={voice.onSelectionChange}
          />
          <VoiceComposerStatus voice={voice} />
          {draft.prompt.length > MAX_PROMPT * 0.9 && (
            <Text className="text-text-low text-text11 mb-4">
              {MAX_PROMPT - draft.prompt.length} characters remaining
            </Text>
          )}

          {/* Session settings — same grouping as the web composer */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-4">
            Session settings
          </Text>
          <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-2 mb-4">
            <ModeSettings
              mode={draft.mode}
              onChange={(m) => updateDraft({ mode: m })}
              checkColor={tokens.brandText.hex}
              mutedColor={tokens.textLow.hex}
            />
            <View className="border-t border-border-subtle mt-2 pt-2 pb-1 flex-row items-center">
              <View className="flex-1 mr-3">
                <Text className="text-text-hi text-text13 font-medium">
                  {activeLaunchProfile ? activeLaunchProfile.name : 'No active launch profile'}
                </Text>
                <Text className="text-text-low text-text11 mt-0.5">
                  Profiles save these Cloud defaults on this device only.
                </Text>
              </View>
              <Pressable
                className="bg-tint-secondary rounded-button px-3 py-2"
                onPress={() => setShowSaveProfile(true)}
                accessibilityRole="button"
                accessibilityLabel="Save current Cloud settings as a launch profile"
              >
                <Text className="text-brand-text text-text12 font-medium">Save profile</Text>
              </Pressable>
            </View>
          </View>

          {/* Repository picker */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowRepoPicker(true)}
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Repositories</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {draft.repos.length > 0 ? draft.repos.join(', ') : 'Any (Devin decides)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>

          {/* Playbook picker */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowPlaybookPicker(true)}
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Playbook</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {selectedPlaybook?.title ?? 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>

          {/* Knowledge attachments */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowKnowledgePicker(true)}
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Knowledge</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {selectedKnowledge.length > 0
                  ? selectedKnowledge.map((k) => k.name).join(', ')
                  : 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>

          {/* Secrets */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-3 flex-row items-center justify-between"
            onPress={() => setShowSecretsPicker(true)}
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Secrets</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {selectedSecrets.length > 0
                  ? selectedSecrets.map((s) => s.key ?? 'Unnamed secret').join(', ')
                  : 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>

          {/* Attachments */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-1 flex-row items-center justify-between"
            onPress={() => setShowAttachmentPicker(true)}
            disabled={uploadAttachment.isPending}
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Attachments</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {uploadAttachment.isPending
                  ? 'Uploading…'
                  : attachments.length > 0
                    ? `${attachments.length} file${attachments.length > 1 ? 's' : ''}`
                    : 'Add photo, video, or file'}
              </Text>
            </View>
            {uploadAttachment.isPending ? (
              <ActivityIndicator size="small" color={tokens.brand.hex} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
            )}
          </Pressable>
          {attachments.length > 0 && (
            <View className="flex-row flex-wrap mb-3 mt-1">
              {attachments.map((a) => (
                <Pressable
                  key={a.url}
                  className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-2 mb-1 flex-row items-center"
                  onPress={() => removeAttachment(a.url)}
                >
                  {a.previewUri && (
                    <Image source={{ uri: a.previewUri }} className="w-6 h-6 rounded-chip mr-1.5" />
                  )}
                  <Text className="text-text-mid text-text12 mr-1" numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Ionicons name="close" size={11} color={tokens.textLow.hex} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Tags */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-2">Tags</Text>
          <View className="flex-row items-center bg-surface1 rounded-input px-3 py-2 mb-2">
            <TextInput
              className="flex-1 text-text14 text-text-hi"
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add a tag and press enter…"
              placeholderTextColor={tokens.textLow.hex}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={addTag}
            />
          </View>
          {draft.tags.length > 0 && (
            <View className="flex-row flex-wrap mb-4">
              {draft.tags.map((tag) => (
                <Pressable
                  key={tag}
                  className="bg-tint-secondary rounded-chip px-pillX py-pillY mr-2 mb-1 flex-row items-center"
                  onPress={() => removeTag(tag)}
                >
                  <Text className="text-text-mid text-text12 mr-1">{tag}</Text>
                  <Ionicons name="close" size={11} color={tokens.textLow.hex} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Advanced options */}
          <Pressable
            className="flex-row items-center justify-between py-3 mt-2"
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text className="text-text-mid text-text14 font-medium">Advanced</Text>
            <Text className="text-text-mid text-text14">{showAdvanced ? '\u25B4' : '\u25BE'}</Text>
          </Pressable>
          {showAdvanced && (
            <View className="mb-4">
              {/* Max ACU limit */}
              <Text className="text-text-low text-text12 font-medium uppercase mb-1">
                Max ACU limit
              </Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1"
                value={draft.maxAcuLimit}
                onChangeText={(v) => updateDraft({ maxAcuLimit: v.replace(/[^0-9]/g, '') })}
                placeholder="No limit"
                placeholderTextColor={tokens.textLow.hex}
                keyboardType="number-pad"
              />
              <Text className="text-text-low text-text12 mb-4">
                Session stops when it consumes this many ACUs. Leave empty for no cap.
              </Text>

              <Text className="text-text-low text-text12 font-medium uppercase mb-1">
                Platform label
              </Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1"
                value={draft.platform}
                onChangeText={(value) => updateDraft({ platform: value.slice(0, 128) })}
                placeholder="Organization default"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text className="text-text-low text-text12 mb-4">
                Optional. Must exactly match a platform configured for your Devin organization.
              </Text>

              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-medium">Preserve VM state</Text>
                  <Text className="text-text-low text-text12 mt-0.5">
                    Keep this session resumable after it stops.
                  </Text>
                </View>
                <Switch
                  value={draft.resumable}
                  onValueChange={(resumable) => updateDraft({ resumable })}
                  trackColor={{ false: tokens.tintSecondary.hex, true: tokens.brand.hex }}
                  thumbColor={tokens.surface2.hex}
                  accessibilityLabel="Preserve VM state"
                />
              </View>

              <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-4">
                Related session links
              </Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1 min-h-20"
                value={draft.sessionLinks}
                onChangeText={(sessionLinks) => updateDraft({ sessionLinks })}
                placeholder="One link per line"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
              />
              <Text className="text-text-low text-text12 mb-4">
                Attach relevant session or work links to the new session.
              </Text>

              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-text-low text-text12 font-medium uppercase">
                    Per-session secrets
                  </Text>
                  <Text className="text-text-low text-text12 mt-0.5">
                    Kept only in memory until this session is created.
                  </Text>
                </View>
                <Pressable
                  className="rounded-button bg-tint-secondary px-3 py-2"
                  onPress={addSessionSecret}
                  accessibilityRole="button"
                  accessibilityLabel="Add per-session secret"
                >
                  <Text className="text-brand-text text-text12 font-medium">Add secret</Text>
                </Pressable>
              </View>
              {sessionSecrets.map((secret) => (
                <View
                  key={secret.id}
                  className="bg-surface1 rounded-card border border-border-subtle px-3 py-3 mb-2"
                >
                  <View className="flex-row items-center mb-2">
                    <TextInput
                      className="flex-1 text-text14 text-text-hi font-mono"
                      value={secret.key}
                      onChangeText={(key) =>
                        updateSessionSecret(secret.id, { key: key.slice(0, 256) })
                      }
                      placeholder="SECRET_NAME"
                      placeholderTextColor={tokens.textLow.hex}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <Pressable
                      className="w-9 h-9 items-center justify-center ml-2"
                      onPress={() => removeSessionSecret(secret.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove session secret ${secret.key || 'row'}`}
                    >
                      <Ionicons name="trash-outline" size={15} color={tokens.failed.hex} />
                    </Pressable>
                  </View>
                  <TextInput
                    className="text-text14 text-text-hi border-t border-border-subtle pt-2"
                    value={secret.value}
                    onChangeText={(value) =>
                      updateSessionSecret(secret.id, { value: value.slice(0, 65_536) })
                    }
                    placeholder="Secret value"
                    placeholderTextColor={tokens.textLow.hex}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>
              ))}

              <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-3">
                Structured output schema
              </Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi font-mono mb-2 min-h-28"
                value={draft.structuredOutputSchema}
                onChangeText={(structuredOutputSchema) => updateDraft({ structuredOutputSchema })}
                placeholder={'{"type":"object","properties":{}}'}
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-medium">
                    Require final structured output
                  </Text>
                  <Text className="text-text-low text-text12 mt-0.5">
                    Applies when a JSON Schema is provided above.
                  </Text>
                </View>
                <Switch
                  value={draft.structuredOutputRequired}
                  onValueChange={(structuredOutputRequired) =>
                    updateDraft({ structuredOutputRequired })
                  }
                  disabled={!draft.structuredOutputSchema.trim()}
                  trackColor={{ false: tokens.tintSecondary.hex, true: tokens.brand.hex }}
                  thumbColor={tokens.surface2.hex}
                  accessibilityLabel="Require final structured output"
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Submit bar */}
        <View
          className={`flex-row items-center gap-2 border-t border-border-subtle px-4 py-3 ${voice.isRecording ? 'hidden' : ''}`}
        >
          <VoiceMicButton voice={voice} disabled={createSession.isPending} />
          <Pressable
            className={`flex-1 rounded-button py-3 items-center ${canSubmit ? 'bg-brand' : 'bg-tint-secondary'}`}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            {createSession.isPending ? (
              <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
            ) : (
              <Text
                className={`text-text14 font-medium ${canSubmit ? 'text-text-always-white' : 'text-text-low'}`}
              >
                Start Session
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AttachmentPickerSheet
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onPick={handleAttachment}
      />

      <Modal
        statusBarTranslucent
        visible={showSaveProfile}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSaveProfile(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-scrim justify-center px-5"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="bg-surface1 rounded-card border border-border-subtle px-5 py-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Save launch profile</Text>
              <Pressable
                className="w-9 h-9 items-center justify-center"
                onPress={() => setShowSaveProfile(false)}
                accessibilityRole="button"
                accessibilityLabel="Close save launch profile"
              >
                <Ionicons name="close" size={18} color={tokens.textMid.hex} />
              </Pressable>
            </View>
            <Text className="text-text-low text-text12 mb-2">Profile name</Text>
            <TextInput
              className="bg-surface2 rounded-input px-3 py-3 text-text14 text-text-hi"
              value={profileName}
              onChangeText={(value) => setProfileName(value.slice(0, 80))}
              placeholder="For example: Mobile release review"
              placeholderTextColor={tokens.textLow.hex}
              maxLength={80}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveLaunchProfile}
            />
            <Text className="text-text-low text-text11 mt-3 leading-4">
              Saves selected repositories, mode, resource IDs, tags, and ACU limit. Prompt text,
              credentials, and per-session secret values are never included.
            </Text>
            <Pressable
              className={`rounded-button py-3 items-center mt-5 ${profileName.trim() ? 'bg-brand' : 'bg-tint-secondary'}`}
              disabled={!profileName.trim()}
              onPress={saveLaunchProfile}
              accessibilityRole="button"
              accessibilityLabel="Save launch profile"
            >
              <Text
                className={`text-text14 font-medium ${profileName.trim() ? 'text-text-always-white' : 'text-text-low'}`}
              >
                Save profile
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Repository picker modal */}
      <Modal
        statusBarTranslucent
        visible={showRepoPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRepoPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[70%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select repositories</Text>
              <Pressable onPress={() => setShowRepoPicker(false)}>
                <Text className="text-brand-text text-text14">Done</Text>
              </Pressable>
            </View>
            {repositories && repositories.length > 0 ? (
              <ScrollView>
                {repositories.map((repo) => {
                  const selected = draft.repos.includes(repo.repo_path);
                  const indexStatus = repositoryIndexPresentation(repo);
                  return (
                    <Pressable
                      key={repo.provider_repository_id}
                      className={`py-3 border-b border-border-subtle flex-row items-center ${selected ? 'bg-tint-primary' : ''}`}
                      onPress={() =>
                        updateDraft({
                          repos: selected
                            ? draft.repos.filter((r) => r !== repo.repo_path)
                            : [...draft.repos, repo.repo_path],
                        })
                      }
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text
                            className={`text-text14 ${selected ? 'text-brand-text font-medium' : 'text-text-hi'}`}
                          >
                            {repo.repo_name}
                          </Text>
                          {indexStatus.indexed && (
                            <View className="flex-row items-center ml-2">
                              <Ionicons name="sparkles" size={10} color={tokens.finished.hex} />
                              <Text className="text-finished text-text11 ml-0.5">indexed</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                          {repo.repo_path}
                          {repo.repo_language ? ` · ${repo.repo_language}` : ''}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark" size={16} color={tokens.brandText.hex} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text className="text-text-mid text-text14">
                No repositories found — connect a git provider in the Devin web app first.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Playbook picker modal */}
      <Modal
        statusBarTranslucent
        visible={showPlaybookPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPlaybookPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[70%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select playbook</Text>
              <Pressable onPress={() => setShowPlaybookPicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {playbooksLoading ? (
              <ActivityIndicator size="small" color={tokens.brand.hex} />
            ) : playbooks && playbooks.length > 0 ? (
              <ScrollView>
                <Pressable
                  className={`py-3 border-b border-border-subtle ${!draft.playbookId ? 'bg-tint-primary' : ''}`}
                  onPress={() => {
                    updateDraft({ playbookId: null });
                    setShowPlaybookPicker(false);
                  }}
                >
                  <Text
                    className={`text-text14 ${!draft.playbookId ? 'text-brand font-medium' : 'text-text-hi'}`}
                  >
                    None
                  </Text>
                </Pressable>
                {playbooks.map((pb) => (
                  <Pressable
                    key={pb.playbook_id}
                    className={`py-3 border-b border-border-subtle ${draft.playbookId === pb.playbook_id ? 'bg-tint-primary' : ''}`}
                    onPress={() => {
                      updateDraft({ playbookId: pb.playbook_id });
                      setShowPlaybookPicker(false);
                    }}
                  >
                    <Text
                      className={`text-text14 ${draft.playbookId === pb.playbook_id ? 'text-brand font-medium' : 'text-text-hi'}`}
                    >
                      {pb.title}
                    </Text>
                    {pb.macro && (
                      <Text className="text-text-low text-text12 mt-0.5">{pb.macro}</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text className="text-text-mid text-text14">No playbooks available.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Knowledge picker modal */}
      <Modal
        statusBarTranslucent
        visible={showKnowledgePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowKnowledgePicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[70%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select knowledge</Text>
              <Pressable onPress={() => setShowKnowledgePicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {knowledge && knowledge.length > 0 ? (
              <ScrollView>
                {knowledge.map((kn) => (
                  <Pressable
                    key={kn.note_id}
                    className={`py-3 border-b border-border-subtle flex-row items-center ${draft.knowledgeIds.includes(kn.note_id) ? 'bg-tint-primary' : ''}`}
                    onPress={() => toggleKnowledge(kn.note_id)}
                  >
                    <View className="flex-1">
                      <Text
                        className={`text-text14 ${draft.knowledgeIds.includes(kn.note_id) ? 'text-brand font-medium' : 'text-text-hi'}`}
                      >
                        {kn.name}
                      </Text>
                      {kn.trigger && (
                        <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                          {kn.trigger}
                        </Text>
                      )}
                    </View>
                    {draft.knowledgeIds.includes(kn.note_id) && (
                      <Text className="text-brand text-text16">{'\u2713'}</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text className="text-text-mid text-text14">No knowledge entries available.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Secrets picker modal */}
      <Modal
        statusBarTranslucent
        visible={showSecretsPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSecretsPicker(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[70%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select secrets</Text>
              <Pressable onPress={() => setShowSecretsPicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {secrets && secrets.length > 0 ? (
              <ScrollView>
                {secrets.map((sec) => (
                  <Pressable
                    key={sec.secret_id}
                    className={`py-3 border-b border-border-subtle flex-row items-center ${draft.secretIds.includes(sec.secret_id) ? 'bg-tint-primary' : ''}`}
                    onPress={() => toggleSecret(sec.secret_id)}
                  >
                    <View className="flex-1">
                      <Text
                        className={`text-text14 ${draft.secretIds.includes(sec.secret_id) ? 'text-brand font-medium' : 'text-text-hi'}`}
                      >
                        {sec.key ?? 'Unnamed secret'}
                      </Text>
                      {sec.note && (
                        <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                          {sec.note}
                        </Text>
                      )}
                    </View>
                    {draft.secretIds.includes(sec.secret_id) && (
                      <Text className="text-brand text-text16">{'\u2713'}</Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text className="text-text-mid text-text14">No secrets available.</Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
