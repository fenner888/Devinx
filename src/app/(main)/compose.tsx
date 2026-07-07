/**
 * Compose screen — spec §7.4.
 * Prompt textarea, optional title, playbook picker, knowledge attachments,
 * mode toggle (normal/fast), tag input, submit → createSession → session detail.
 * Draft persistence via AsyncStorage.
 */
import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useCreateSession, usePlaybooks, useKnowledge, useSecrets, useUploadAttachment } from '@api/devin/queries';
import type { DevinMode } from '@api/devin/types';
import { useTheme } from '@theme/index';

const DRAFT_KEY = '@devinx/compose-draft';
const MAX_PROMPT = 10000;
const MAX_TITLE = 200;

interface Draft {
  prompt: string;
  title: string;
  playbookId: string | null;
  knowledgeIds: string[];
  secretIds: string[];
  mode: DevinMode;
  tags: string[];
  maxAcuLimit: string;
  unlisted: boolean;
}

const emptyDraft: Draft = {
  prompt: '',
  title: '',
  playbookId: null,
  knowledgeIds: [],
  secretIds: [],
  mode: 'normal',
  tags: [],
  maxAcuLimit: '',
  unlisted: false,
};

export default function ComposeScreen() {
  const router = useRouter();
  const createSession = useCreateSession();
  const { data: playbooks, isLoading: playbooksLoading } = usePlaybooks();
  const { data: knowledge } = useKnowledge();
  const { data: secrets } = useSecrets();
  const uploadAttachment = useUploadAttachment();
  const { tokens } = useTheme();

  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [showSecretsPicker, setShowSecretsPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Load draft from AsyncStorage on mount.
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then((json) => {
        if (json) {
          try {
            setDraft({ ...emptyDraft, ...JSON.parse(json) });
          } catch {
            // ignore corrupt draft
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  // Persist draft on change (debounced via useEffect).
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {
        // ignore storage errors
      });
    }, 500);
    return () => clearTimeout(id);
  }, [draft, loaded]);

  const canSubmit = draft.prompt.trim().length > 0 && !createSession.isPending;

  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

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

  async function pickAttachment() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const uploaded = await uploadAttachment.mutateAsync({
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
        uri: asset.uri,
      });
      setAttachments((prev) => [...prev, { name: uploaded.name, url: uploaded.url }]);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  async function handleSubmit() {
    if (!draft.prompt.trim()) return;
    try {
      const acuLimit = parseFloat(draft.maxAcuLimit);
      const session = await createSession.mutateAsync({
        prompt: draft.prompt.trim(),
        title: draft.title.trim() || undefined,
        playbook_id: draft.playbookId ?? undefined,
        knowledge_ids: draft.knowledgeIds.length > 0 ? draft.knowledgeIds : undefined,
        secret_ids: draft.secretIds.length > 0 ? draft.secretIds : undefined,
        devin_mode: draft.mode,
        tags: draft.tags.length > 0 ? draft.tags : undefined,
        max_acu_limit: Number.isFinite(acuLimit) && acuLimit > 0 ? acuLimit : undefined,
        unlisted: draft.unlisted || undefined,
        attachment_urls: attachments.length > 0 ? attachments.map((a) => a.url) : undefined,
      });
      // Clear draft on success.
      await AsyncStorage.removeItem(DRAFT_KEY);
      setDraft(emptyDraft);
      router.replace(`/(main)/session/${session.session_id}`);
    } catch (e) {
      Alert.alert(
        'Could not create session',
        e instanceof Error ? e.message : 'Unknown error',
      );
    }
  }

  if (!loaded) {
    return (
      <SafeAreaView className="flex-1 bg-surface0 items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#4489FF" />
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
          <Pressable onPress={() => router.back()}>
            <Text className="text-brand text-text14">{'\u2190 Cancel'}</Text>
          </Pressable>
          <Text className="text-text-hi text-text17">New Session</Text>
          <View className="w-16" />
        </View>

        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          {/* Title (optional) */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1">Title (optional)</Text>
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
            className="bg-surface1 rounded-input px-3 py-3 text-text14 text-text-hi mb-1 min-h-32"
            value={draft.prompt}
            onChangeText={(v) => updateDraft({ prompt: v.slice(0, MAX_PROMPT) })}
            placeholder="Describe what you want Devin to do…"
            placeholderTextColor={tokens.textLow.hex}
            multiline
            textAlignVertical="top"
            maxLength={MAX_PROMPT}
          />
          {draft.prompt.length > MAX_PROMPT * 0.9 && (
            <Text className="text-text-low text-text11 mb-4">
              {MAX_PROMPT - draft.prompt.length} characters remaining
            </Text>
          )}

          {/* Mode toggle */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-4">Mode</Text>
          <View className="flex-row bg-tint-secondary rounded-button p-1 mb-4">
            {(['normal', 'fast'] as const).map((m) => (
              <Pressable
                key={m}
                className={`flex-1 rounded-button py-2 ${draft.mode === m ? 'bg-surface2' : ''}`}
                onPress={() => updateDraft({ mode: m })}
              >
                <Text className={`text-center text-text14 capitalize ${draft.mode === m ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>

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
            <Text className="text-text-mid text-text14">{'\u203A'}</Text>
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
            <Text className="text-text-mid text-text14">{'\u203A'}</Text>
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
                  ? selectedSecrets.map((s) => s.key).join(', ')
                  : 'None'}
              </Text>
            </View>
            <Text className="text-text-mid text-text14">{'\u203A'}</Text>
          </Pressable>

          {/* Attachments */}
          <Pressable
            className="bg-surface1 rounded-input px-3 py-3 mb-1 flex-row items-center justify-between"
            onPress={pickAttachment}
            disabled={uploadAttachment.isPending}
          >
            <View className="flex-1">
              <Text className="text-text-low text-text12 mb-0.5">Attachments</Text>
              <Text className="text-text14 text-text-hi" numberOfLines={1}>
                {uploadAttachment.isPending
                  ? 'Uploading…'
                  : attachments.length > 0
                    ? `${attachments.length} file${attachments.length > 1 ? 's' : ''}`
                    : 'Add a file'}
              </Text>
            </View>
            {uploadAttachment.isPending ? (
              <ActivityIndicator size="small" color="#4489FF" />
            ) : (
              <Text className="text-text-mid text-text14">{'\u203A'}</Text>
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
                  <Text className="text-text-mid text-text12 mr-1" numberOfLines={1}>{a.name}</Text>
                  <Text className="text-text-low text-text12">{'\u00D7'}</Text>
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
                  <Text className="text-text-low text-text12">{'\u00D7'}</Text>
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
              <Text className="text-text-low text-text12 font-medium uppercase mb-1">Max ACU limit</Text>
              <TextInput
                className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1"
                value={draft.maxAcuLimit}
                onChangeText={(v) => updateDraft({ maxAcuLimit: v.replace(/[^0-9.]/g, '') })}
                placeholder="No limit"
                placeholderTextColor={tokens.textLow.hex}
                keyboardType="decimal-pad"
              />
              <Text className="text-text-low text-text12 mb-4">
                Session stops when it consumes this many ACUs. Leave empty for no cap.
              </Text>

              {/* Unlisted toggle */}
              <Pressable
                className="flex-row items-center justify-between bg-surface1 rounded-input px-3 py-3"
                onPress={() => updateDraft({ unlisted: !draft.unlisted })}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-text14 text-text-hi mb-0.5">Unlisted</Text>
                  <Text className="text-text-low text-text12">
                    Only visible to you and people with the link.
                  </Text>
                </View>
                <View className={`w-12 h-7 rounded-chip p-0.5 ${draft.unlisted ? 'bg-brand' : 'bg-tint-primary'}`}>
                  <View className={`w-6 h-6 rounded-chip bg-surface2 ${draft.unlisted ? 'ml-auto' : ''}`} />
                </View>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Submit bar */}
        <View className="border-t border-border-subtle px-4 py-3">
          <Pressable
            className={`rounded-button py-3 items-center ${canSubmit ? 'bg-brand' : 'bg-tint-secondary'}`}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            {createSession.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className={`text-text14 font-medium ${canSubmit ? 'text-text-always-white' : 'text-text-low'}`}>
                Start Session
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Playbook picker modal */}
      <Modal visible={showPlaybookPicker} animationType="slide" transparent onRequestClose={() => setShowPlaybookPicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface1 rounded-t-card px-5 py-6 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Select playbook</Text>
              <Pressable onPress={() => setShowPlaybookPicker(false)}>
                <Text className="text-brand text-text14">Done</Text>
              </Pressable>
            </View>
            {playbooksLoading ? (
              <ActivityIndicator size="small" color="#4489FF" />
            ) : playbooks && playbooks.length > 0 ? (
              <ScrollView>
                <Pressable
                  className={`py-3 border-b border-border-subtle ${!draft.playbookId ? 'bg-tint-primary' : ''}`}
                  onPress={() => {
                    updateDraft({ playbookId: null });
                    setShowPlaybookPicker(false);
                  }}
                >
                  <Text className={`text-text14 ${!draft.playbookId ? 'text-brand font-medium' : 'text-text-hi'}`}>
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
                    <Text className={`text-text14 ${draft.playbookId === pb.playbook_id ? 'text-brand font-medium' : 'text-text-hi'}`}>
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
      <Modal visible={showKnowledgePicker} animationType="slide" transparent onRequestClose={() => setShowKnowledgePicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface1 rounded-t-card px-5 py-6 max-h-[70%]">
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
                      <Text className={`text-text14 ${draft.knowledgeIds.includes(kn.note_id) ? 'text-brand font-medium' : 'text-text-hi'}`}>
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
      <Modal visible={showSecretsPicker} animationType="slide" transparent onRequestClose={() => setShowSecretsPicker(false)}>
        <View className="flex-1 bg-scrim justify-end">
          <View className="bg-surface1 rounded-t-card px-5 py-6 max-h-[70%]">
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
                      <Text className={`text-text14 ${draft.secretIds.includes(sec.secret_id) ? 'text-brand font-medium' : 'text-text-hi'}`}>
                        {sec.key}
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
