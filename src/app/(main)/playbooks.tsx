/**
 * Playbooks — org playbook management (v3 playbooks API), mirroring the
 * web Settings → Playbooks page: search, create, edit, delete.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaybooks, useCreatePlaybook, useUpdatePlaybook, useDeletePlaybook } from '@api/devin/queries';
import { EmptyState, ErrorState } from '@components/Skeletons';
import { hapticSuccess, hapticError, hapticWarning } from '@lib/haptics';
import { confirmAction } from '@lib/confirm';
import { useTheme } from '@theme/index';
import type { PlaybookResponse } from '@api/devin/types';

interface EditorState {
  playbookId: string | null; // null = create
  title: string;
  body: string;
}

export default function PlaybooksScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { data: playbooks, isLoading, error, refetch, isRefetching } = usePlaybooks();
  const createPlaybook = useCreatePlaybook();
  const updatePlaybook = useUpdatePlaybook();
  const deletePlaybook = useDeletePlaybook();

  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!playbooks) return [];
    const q = search.trim().toLowerCase();
    if (!q) return playbooks;
    return playbooks.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.macro ?? '').toLowerCase().includes(q),
    );
  }, [playbooks, search]);

  const saving = createPlaybook.isPending || updatePlaybook.isPending;
  const canSave = !!editor && editor.title.trim() && editor.body.trim() && !saving;

  function handleSave() {
    if (!editor || !canSave) return;
    setEditorError(null);
    const body = { title: editor.title.trim(), body: editor.body.trim() };
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
    if (editor.playbookId) {
      updatePlaybook.mutate({ playbookId: editor.playbookId, body }, opts);
    } else {
      createPlaybook.mutate(body, opts);
    }
  }

  function handleDelete(pb: PlaybookResponse) {
    hapticWarning();
    confirmAction(
      {
        title: 'Delete playbook?',
        message: `"${pb.title}" will no longer be available in the composer.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => deletePlaybook.mutate(pb.playbook_id, { onError: () => hapticError() }),
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
        <Text className="text-text-hi text-text17 flex-1">Playbooks</Text>
        <Pressable
          className="flex-row items-center bg-brand rounded-button px-3 py-2"
          onPress={() => {
            setEditorError(null);
            setEditor({ playbookId: null, title: '', body: '' });
          }}
          accessibilityRole="button"
          accessibilityLabel="Create playbook"
        >
          <Ionicons name="add" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text13 font-medium ml-1">New</Text>
        </Pressable>
      </View>

      <Text className="text-text-mid text-text13 px-4 pt-3">
        Reusable system prompts that customize how Devin works.
      </Text>

      {/* Search */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search playbooks…"
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

      {error && !playbooks && (
        <ErrorState title="Could not load playbooks" message={error.message} onRetry={() => refetch()} />
      )}

      {!isLoading && playbooks && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={search ? 'No matches' : 'No playbooks yet'}
          message={search ? 'No playbooks match your search.' : 'Create a playbook to get started.'}
        />
      )}

      {playbooks && filtered.length > 0 && (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {filtered.map((pb) => (
            <Pressable
              key={pb.playbook_id}
              className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-3"
              onPress={() => {
                setEditorError(null);
                setEditor({ playbookId: pb.playbook_id, title: pb.title, body: pb.body });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${pb.title}`}
            >
              <View className="flex-row items-center">
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-medium" numberOfLines={1}>{pb.title}</Text>
                  {pb.macro && (
                    <Text className="text-brand-text text-text12 mt-0.5 font-mono" numberOfLines={1}>
                      {pb.macro}
                    </Text>
                  )}
                  <Text className="text-text-low text-text12 mt-0.5" numberOfLines={2}>{pb.body}</Text>
                </View>
                <Pressable
                  className="w-8 h-8 rounded-full items-center justify-center"
                  onPress={() => handleDelete(pb)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${pb.title}`}
                >
                  <Ionicons name="trash-outline" size={15} color={tokens.failed.hex} />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Create/edit sheet */}
      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 bg-scrim justify-end">
            <View className="bg-surface2 rounded-t-sheet px-5 py-4 max-h-[85%]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-hi text-text17">
                  {editor?.playbookId ? 'Edit playbook' : 'Create playbook'}
                </Text>
                <Pressable onPress={() => setEditor(null)}>
                  <Ionicons name="close" size={18} color={tokens.textMid.hex} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Name</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3"
                  value={editor?.title ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, title: v } : e))}
                  placeholder="Release checklist"
                  placeholderTextColor={tokens.textLow.hex}
                  maxLength={200}
                />
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Instructions</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3 min-h-36"
                  value={editor?.body ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, body: v } : e))}
                  placeholder="What should Devin do when this playbook runs?"
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
                      {editor?.playbookId ? 'Save changes' : 'Create playbook'}
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
