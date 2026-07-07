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
import { useCreateSession, usePlaybooks, useKnowledge } from '@api/devin/queries';
import type { DevinMode } from '@api/devin/types';

const DRAFT_KEY = '@devinx/compose-draft';
const MAX_PROMPT = 10000;
const MAX_TITLE = 200;

interface Draft {
  prompt: string;
  title: string;
  playbookId: string | null;
  knowledgeIds: string[];
  mode: DevinMode;
  tags: string[];
}

const emptyDraft: Draft = {
  prompt: '',
  title: '',
  playbookId: null,
  knowledgeIds: [],
  mode: 'normal',
  tags: [],
};

export default function ComposeScreen() {
  const router = useRouter();
  const createSession = useCreateSession();
  const { data: playbooks, isLoading: playbooksLoading } = usePlaybooks();
  const { data: knowledge } = useKnowledge();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [showPlaybookPicker, setShowPlaybookPicker] = useState(false);
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
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

  async function handleSubmit() {
    if (!draft.prompt.trim()) return;
    try {
      const session = await createSession.mutateAsync({
        prompt: draft.prompt.trim(),
        title: draft.title.trim() || undefined,
        playbook_id: draft.playbookId ?? undefined,
        knowledge_ids: draft.knowledgeIds.length > 0 ? draft.knowledgeIds : undefined,
        devin_mode: draft.mode,
        tags: draft.tags.length > 0 ? draft.tags : undefined,
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
            placeholderTextColor="#FFFFFF66"
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
            placeholderTextColor="#FFFFFF66"
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

          {/* Tags */}
          <Text className="text-text-low text-text12 font-medium uppercase mb-1 mt-2">Tags</Text>
          <View className="flex-row items-center bg-surface1 rounded-input px-3 py-2 mb-2">
            <TextInput
              className="flex-1 text-text14 text-text-hi"
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add a tag and press enter…"
              placeholderTextColor="#FFFFFF66"
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
    </SafeAreaView>
  );
}
