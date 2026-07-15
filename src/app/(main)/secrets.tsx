/**
 * Secrets — org secret management (v3 secrets API), mirroring the web
 * Settings → Secrets page. Values are write-only: entered once on create,
 * never displayed or readable afterwards.
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
import { useSecrets, useCreateSecret, useDeleteSecret } from '@api/devin/queries';
import { EmptyState, ErrorState } from '@components/Skeletons';
import { hapticSuccess, hapticError, hapticWarning } from '@lib/haptics';
import { confirmAction } from '@lib/confirm';
import { userFacingError } from '@lib/user-facing-error';
import { useTheme } from '@theme/index';
import type { SecretResponse, SecretType } from '@api/devin/types';

const SECRET_TYPES: { key: SecretType; label: string }[] = [
  { key: 'key-value', label: 'Key-value' },
  { key: 'cookie', label: 'Cookie' },
  { key: 'totp', label: 'TOTP' },
];

export default function SecretsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: secrets, isLoading, error, refetch, isRefetching } = useSecrets();
  const createSecret = useCreateSecret();
  const deleteSecret = useDeleteSecret();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<SecretType>('key-value');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!secrets) return [];
    const q = search.trim().toLowerCase();
    if (!q) return secrets;
    return secrets.filter(
      (s) => s.key.toLowerCase().includes(q) || (s.note ?? '').toLowerCase().includes(q),
    );
  }, [secrets, search]);

  const canSave = key.trim().length > 0 && value.trim().length > 0 && !createSecret.isPending;

  function handleCreate() {
    if (!canSave) return;
    setCreateError(null);
    createSecret.mutate(
      { type, key: key.trim(), value, note: note.trim() || undefined },
      {
        onSuccess: () => {
          hapticSuccess();
          setShowCreate(false);
          setKey('');
          setValue('');
          setNote('');
          setType('key-value');
        },
        onError: (e) => {
          hapticError();
          setCreateError(userFacingError(e, 'Could not create this secret.'));
        },
      },
    );
  }

  function handleDelete(secret: SecretResponse) {
    hapticWarning();
    confirmAction(
      {
        title: 'Delete secret?',
        message: `"${secret.key}" will no longer be available to sessions. This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => deleteSecret.mutate(secret.secret_id, { onError: () => hapticError() }),
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
        <Text className="text-text-hi text-text17 flex-1">Secrets</Text>
        <Pressable
          className="flex-row items-center bg-brand rounded-button px-3 py-2"
          onPress={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Add secret"
        >
          <Ionicons name="add" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text13 font-medium ml-1">Add</Text>
        </Pressable>
      </View>

      <Text className="text-text-mid text-text13 px-4 pt-3">
        Reference a secret in prompts with a dollar sign, e.g. $SERVICE_USERNAME.
      </Text>

      {/* Search */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search secrets…"
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

      {error && !secrets && (
        <ErrorState
          title="Could not load secrets"
          message={userFacingError(error, 'Secrets are unavailable right now.')}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && secrets && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={search ? 'No matches' : 'No secrets found'}
          message={search ? 'No secrets match your search.' : 'Add your first secret to get started.'}
        />
      )}

      {secrets && filtered.length > 0 && (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={tokens.brand.hex} />
          }
        >
          {filtered.map((s) => (
            <View key={s.secret_id} className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-3">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-button bg-tint-secondary items-center justify-center mr-3">
                  <Ionicons name="lock-closed-outline" size={14} color={tokens.textMid.hex} />
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14 font-mono" numberOfLines={1}>{s.key ?? '—'}</Text>
                  <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                    {s.secret_type}{s.note ? ` · ${s.note}` : ''}
                  </Text>
                </View>
                <Pressable
                  className="w-8 h-8 rounded-full items-center justify-center"
                  onPress={() => handleDelete(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${s.key}`}
                >
                  <Ionicons name="trash-outline" size={15} color={tokens.failed.hex} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create sheet */}
      <Modal statusBarTranslucent visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 bg-scrim justify-end">
            <View className="bg-surface2 rounded-t-sheet px-5 pt-4 max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-text-hi text-text17">Add secret</Text>
                <Pressable
                  onPress={() => setShowCreate(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close add secret"
                >
                  <Ionicons name="close" size={18} color={tokens.textMid.hex} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Type</Text>
                <View className="flex-row bg-tint-secondary rounded-button p-1 mb-3">
                  {SECRET_TYPES.map(({ key: k, label }) => (
                    <Pressable
                      key={k}
                      className={`flex-1 rounded-button py-2 ${type === k ? 'bg-surface1' : ''}`}
                      onPress={() => setType(k)}
                    >
                      <Text className={`text-center text-text13 ${type === k ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Name</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi font-mono mb-3"
                  value={key}
                  onChangeText={setKey}
                  placeholder="SERVICE_USERNAME"
                  placeholderTextColor={tokens.textLow.hex}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={256}
                />
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Value</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-1"
                  value={value}
                  onChangeText={setValue}
                  placeholder="Secret value"
                  placeholderTextColor={tokens.textLow.hex}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
                <Text className="text-text-low text-text12 mb-3">
                  Write-only — the value can never be viewed again after saving.
                </Text>
                <Text className="text-text-low text-text12 font-medium uppercase mb-1">Note (optional)</Text>
                <TextInput
                  className="bg-surface1 rounded-input px-3 py-2 text-text14 text-text-hi mb-3"
                  value={note}
                  onChangeText={setNote}
                  placeholder="What this secret is for"
                  placeholderTextColor={tokens.textLow.hex}
                />
                {createError && (
                  <View className="flex-row items-start bg-tint-red rounded-card px-3 py-2 mb-3">
                    <Ionicons name="alert-circle-outline" size={13} color={tokens.failed.hex} />
                    <Text className="text-failed text-text12 ml-2 flex-1">{createError}</Text>
                  </View>
                )}
                <Pressable
                  className={`rounded-button py-3 items-center mb-2 ${canSave ? 'bg-brand' : 'bg-tint-secondary'}`}
                  disabled={!canSave}
                  onPress={handleCreate}
                >
                  {createSecret.isPending ? (
                    <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                  ) : (
                    <Text className={`text-text14 font-medium ${canSave ? 'text-text-always-white' : 'text-text-low'}`}>
                      Add secret
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
