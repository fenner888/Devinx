import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCreateSession, useRepositories } from '@api/devin/queries';
import {
  buildEnvironmentAssistantPrompt,
  environmentAssistantInputSchema,
} from '@lib/environment-assistant';
import { rememberSessionRepository } from '@lib/session-repository';
import { userFacingError } from '@lib/user-facing-error';
import { useTheme } from '@theme/index';

export default function EnvironmentSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const repositoriesQuery = useRepositories();
  const repositories = repositoriesQuery.data;
  const createSession = useCreateSession();
  const [repositoryPath, setRepositoryPath] = useState('');
  const [runtimesAndTools, setRuntimesAndTools] = useState('');
  const [bootstrap, setBootstrap] = useState('');
  const [validation, setValidation] = useState('');
  const [constraints, setConstraints] = useState('');
  const [showRepositories, setShowRepositories] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const parsed = useMemo(
    () =>
      environmentAssistantInputSchema.safeParse({
        repositoryPath,
        runtimesAndTools,
        bootstrap,
        validation,
        constraints,
      }),
    [repositoryPath, runtimesAndTools, bootstrap, validation, constraints],
  );
  const prompt = parsed.success ? buildEnvironmentAssistantPrompt(parsed.data) : '';

  async function createSetupSession() {
    if (!parsed.success) return;
    try {
      const session = await createSession.mutateAsync({
        title: `Environment setup: ${parsed.data.repositoryPath.split('/').pop() ?? 'repository'}`,
        prompt,
        repos: [parsed.data.repositoryPath],
        tags: ['devinx-environment'],
        devin_mode: 'normal',
      });
      await rememberSessionRepository(session.session_id, parsed.data.repositoryPath);
      setShowPreview(false);
      router.replace(`/(main)/session/${session.session_id}`);
    } catch (error) {
      Alert.alert(
        'Could not start environment session',
        userFacingError(error, 'The environment session could not be started.'),
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center px-4 pt-2 pb-4">
          <Pressable
            className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-text-hi text-text20">Environment setup</Text>
            <Text className="text-text-low text-text12 mt-0.5">Guided Cloud session</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View className="bg-tint-blue rounded-card px-4 py-3 mb-5 flex-row">
            <Ionicons name="shield-checkmark-outline" size={18} color={tokens.brandText.hex} />
            <Text className="text-brand-text text-text12 leading-4 flex-1 ml-2">
              Devin does not publish a mobile blueprint-editing API. This assistant previews and
              starts a normal Cloud session—never a private web request—and reports any manual
              organization step still required.
            </Text>
          </View>

          <Text className="text-text-low text-text12 font-medium uppercase mb-1">Repository</Text>
          <Pressable
            className="bg-surface1 border border-border-subtle rounded-input px-3 py-3 mb-4 flex-row items-center"
            onPress={() => setShowRepositories(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose repository"
          >
            <Ionicons name="folder-outline" size={17} color={tokens.textMid.hex} />
            <Text
              className={`text-text14 flex-1 ml-2 ${repositoryPath ? 'text-text-hi' : 'text-text-low'}`}
              numberOfLines={1}
            >
              {repositoryPath || 'Choose an accessible repository'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>

          <Field
            label="Required runtimes and tools"
            value={runtimesAndTools}
            onChangeText={setRuntimesAndTools}
            placeholder="Node.js 22, Python 3.12, Xcode…"
            maxLength={2_000}
            required
          />
          <Field
            label="Dependency and bootstrap steps"
            value={bootstrap}
            onChangeText={setBootstrap}
            placeholder="npm ci, database setup, fixture loading…"
            maxLength={4_000}
          />
          <Field
            label="Validation commands"
            value={validation}
            onChangeText={setValidation}
            placeholder="npm run lint, npm run typecheck, npm test…"
            maxLength={4_000}
          />
          <Field
            label="Constraints and non-goals"
            value={constraints}
            onChangeText={setConstraints}
            placeholder="Do not touch production data or change app behavior…"
            maxLength={4_000}
          />

          <Pressable
            className={`rounded-button py-3 items-center mt-2 ${parsed.success ? 'bg-brand' : 'bg-tint-secondary'}`}
            disabled={!parsed.success}
            onPress={() => setShowPreview(true)}
            accessibilityRole="button"
            accessibilityLabel="Preview environment setup session"
          >
            <Text
              className={`text-text14 font-medium ${parsed.success ? 'text-text-always-white' : 'text-text-low'}`}
            >
              Preview session
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        statusBarTranslucent
        visible={showRepositories}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRepositories(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[75%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text-hi text-text17">Choose repository</Text>
              <Pressable
                onPress={() => setShowRepositories(false)}
                accessibilityRole="button"
                accessibilityLabel="Close repository picker"
              >
                <Ionicons name="close" size={20} color={tokens.textMid.hex} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {repositoriesQuery.isLoading ? (
                <ActivityIndicator className="my-8" size="small" color={tokens.brand.hex} />
              ) : repositoriesQuery.isError ? (
                <View className="items-center py-8 px-4">
                  <Text className="text-text-mid text-text14 text-center leading-5">
                    Repositories could not be loaded. Check this service user&apos;s repository
                    access and try again.
                  </Text>
                  <Pressable
                    className="bg-tint-secondary rounded-button px-4 py-2.5 mt-4"
                    onPress={() => repositoriesQuery.refetch()}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading repositories"
                  >
                    <Text className="text-text-hi text-text13 font-medium">Try again</Text>
                  </Pressable>
                </View>
              ) : (
                (repositories ?? []).map((repo) => (
                  <Pressable
                    key={repo.provider_repository_id}
                    className={`py-3 border-b border-border-subtle flex-row items-center ${repositoryPath === repo.repo_path ? 'bg-tint-blue' : ''}`}
                    onPress={() => {
                      setRepositoryPath(repo.repo_path);
                      setShowRepositories(false);
                    }}
                  >
                    <View className="flex-1">
                      <Text className="text-text-hi text-text14">{repo.repo_name}</Text>
                      <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                        {repo.repo_path}
                      </Text>
                    </View>
                    {repositoryPath === repo.repo_path && (
                      <Ionicons name="checkmark" size={18} color={tokens.brandText.hex} />
                    )}
                  </Pressable>
                ))
              )}
              {repositoriesQuery.isSuccess && (repositories ?? []).length === 0 && (
                <Text className="text-text-mid text-text14 py-8 text-center">
                  No accessible repositories were returned for this service user.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        statusBarTranslucent
        visible={showPreview}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreview(false)}
      >
        <View className="flex-1 bg-scrim justify-end">
          <View
            className="bg-surface1 rounded-t-card px-5 pt-6 max-h-[88%]"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-text-hi text-text17">Review session prompt</Text>
              <Pressable
                onPress={() => setShowPreview(false)}
                accessibilityRole="button"
                accessibilityLabel="Close session prompt preview"
              >
                <Ionicons name="close" size={20} color={tokens.textMid.hex} />
              </Pressable>
            </View>
            <Text className="text-text-low text-text12 mb-3">
              This exact text will become a normal Devin Cloud session.
            </Text>
            <ScrollView className="bg-surface2 rounded-input px-4 py-3 mb-4">
              <Text className="text-text-mid text-text13 leading-5" selectable>
                {prompt}
              </Text>
            </ScrollView>
            <Pressable
              className="bg-brand rounded-button py-3 items-center"
              onPress={createSetupSession}
              disabled={createSession.isPending}
            >
              {createSession.isPending ? (
                <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
              ) : (
                <Text className="text-text-always-white text-text14 font-medium">
                  Start setup session
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  required?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View className="mb-4">
      <Text className="text-text-low text-text12 font-medium uppercase mb-1">
        {label}
        {required ? ' · required' : ''}
      </Text>
      <TextInput
        className="bg-surface1 border border-border-subtle rounded-input px-3 py-3 text-text14 text-text-hi min-h-24"
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={tokens.textLow.hex}
        multiline
        textAlignVertical="top"
        accessibilityLabel={label}
      />
    </View>
  );
}
