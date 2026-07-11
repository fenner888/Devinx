/**
 * Knowledge — org knowledge-note management (v3 notes API), mirroring the
 * web Settings → Knowledge page: search, create, edit, enable toggle, delete.
 */
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKnowledge, useCreateKnowledgeNote, useUpdateKnowledgeNote, useDeleteKnowledgeNote } from '@api/devin/queries';
import { EmptyState, ErrorState } from '@components/Skeletons';
import { hapticSuccess, hapticError, hapticWarning, hapticLight } from '@lib/haptics';
import { confirmAction } from '@lib/confirm';
import { useTheme } from '@theme/index';
import type { KnowledgeNoteResponse } from '@api/devin/types';

interface EditorState {
  noteId: string | null; // null = create
  name: string;
  trigger: string;
  body: string;
}

export default function KnowledgeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: notes, isLoading, error, refetch, isRefetching } = useKnowledge();
  const createNote = useCreateKnowledgeNote();
  const updateNote = useUpdateKnowledgeNote();
  const deleteNote = useDeleteKnowledgeNote();

  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!notes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.trigger.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const saving = createNote.isPending || updateNote.isPending;
  const canSave = !!editor && editor.name.trim() && editor.trigger.trim() && editor.body.trim() && !saving;

  function openCreate() {
    setEditorError(null);
    setEditor({ noteId: null, name: '', trigger: '', body: '' });
  }

  function openEdit(note: KnowledgeNoteResponse) {
    setEditorError(null);
    setEditor({ noteId: note.note_id, name: note.name, trigger: note.trigger, body: note.body });
  }

  function handleSave() {
    if (!editor || !canSave) return;
    setEditorError(null);
    const body = { name: editor.name.trim(), trigger: editor.trigger.trim(), body: editor.body.trim() };
    const opts = {
      onSuccess: () => {
        hapticSuccess();
        setEditor(null);
      },
      onError: (e: Error) => {
        hapticError();
        setEditorError(e.message);
      },
    };
    if (editor.noteId) {
      updateNote.mutate({ noteId: editor.noteId, body }, opts);
    } else {
      createNote.mutate(body, opts);
    }
  }

  function handleToggle(note: KnowledgeNoteResponse) {
    hapticLight();
    updateNote.mutate(
      { noteId: note.note_id, body: { is_enabled: !(note.is_enabled ?? true) } },
      { onError: () => hapticError() },
    );
  }

  function handleDelete(note: KnowledgeNoteResponse) {
    hapticWarning();
    confirmAction(
      {
        title: 'Delete knowledge?',
        message: `"${note.name}" will no longer be recalled in sessions.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => deleteNote.mutate(note.note_id, { onError: () => hapticError() }),
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17 flex-1">Knowledge</Text>
        <Pressable
          className="flex-row items-center bg-brand rounded-button px-3 py-2"
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel="Create knowledge"
        >
          <Ionicons name="add" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text13 font-medium ml-1">New</Text>
        </Pressable>
      </View>

      <Text className="text-text-mid text-text13 px-4 pt-3">
        Devin recalls relevant knowledge automatically during sessions.
      </Text>

      {/* Search */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search for knowledge…"
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {error && !notes && (
        <ErrorState title="Could not load knowledge" message={error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && notes && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={search ? 'No matches' : 'No knowledge yet'}
          message={search ? 'No notes match your search.' : 'Create a note and Devin will recall it when the trigger matches.'}
        />
      )}

      {notes && filtered.length > 0 && (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {filtered.map((n) => (
            <Pressable
              key={n.note_id}
              className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-3"
              onPress={() => openEdit(n)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${n.name}`}
            >
              <View className="flex-row items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-medium" numberOfLines={1}>{n.name}</Text>
                  <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                    Trigger: {n.trigger}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleToggle(n)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: n.is_enabled ?? true }}
                  accessibilityLabel={`${n.name} enabled`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View className={`w-12 h-7 rounded-chip p-0.5 ${(n.is_enabled ?? true) ? 'bg-brand' : 'bg-tint-primary'}`}>
                    <View className={`w-6 h-6 rounded-chip bg-surface2 ${(n.is_enabled ?? true) ? 'ml-auto' : ''}`} />
                  </View>
                </Pressable>
              </View>
              <View className="flex-row items-center mt-2">
                <Text className="text-text-low text-text12 flex-1" numberOfLines={1}>{n.body}</Text>
                <Pressable
                  className="w-8 h-8 rounded-full items-center justify-center"
                  onPress={() => handleDelete(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${n.name}`}
                >
                  <Ionicons name="trash-outline" size={15} color={tokens.failed.hex} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Create/edit sheet */}
      <Modal statusBarTranslucent visible={!!editor} animationType="slide" transparent onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 bg-scrim justify-end">
            <View className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-hi text-text17">
                  {editor?.noteId ? 'Edit knowledge' : 'Create knowledge'}
                </Text>
                <Pressable
                  onPress={() => setEditor(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close knowledge editor"
                >
                  <Ionicons name="close" size={18} color={tokens.textMid.hex} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Name</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3"
                  value={editor?.name ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, name: v } : e))}
                  placeholder="Deployment checklist"
                  placeholderTextColor={tokens.textLow.hex}
                  maxLength={200}
                />
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Trigger</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1"
                  value={editor?.trigger ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, trigger: v } : e))}
                  placeholder="When deploying to production…"
                  placeholderTextColor={tokens.textLow.hex}
                />
                <Text className="text-text-low text-text12 mb-3">
                  Describes when Devin should recall this note.
                </Text>
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Content</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3 min-h-28"
                  value={editor?.body ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, body: v } : e))}
                  placeholder="The knowledge itself…"
                  placeholderTextColor={tokens.textLow.hex}
                  multiline
                  textAlignVertical="top"
                />
                {editorError && (
                  <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mb-3">
                    <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
                    <Text className="text-failed text-text12 ml-2 flex-1">{editorError}</Text>
                  </View>
                )}
                <Pressable
                  className={`rounded-button py-3 items-center mb-2 ${canSave ? 'bg-brand' : 'bg-tint-secondary'}`}
                  disabled={!canSave}
                  onPress={handleSave}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                  ) : (
                    <Text className={`text-text14 font-medium ${canSave ? 'text-text-always-white' : 'text-text-low'}`}>
                      {editor?.noteId ? 'Save changes' : 'Create knowledge'}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
