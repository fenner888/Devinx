import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAskWikiQuestion, useWikiContents, useWikiStructure } from '@api/devin/mcpQueries';
import { useRepositories } from '@api/devin/queries';
import { useAuth } from '@auth/AuthContext';
import { DevinMarkdown } from '@components/DevinMarkdown';
import { ErrorState } from '@components/Skeletons';
import { repositoryIndexPresentation } from '@lib/repository-indexing';
import { useTheme } from '@theme/index';

function stringParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function WikiScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ repo?: string | string[] }>();
  const repoName = stringParam(params.repo).trim();
  const repositories = useRepositories();
  const repositoryIsAvailable = !!repositories.data?.some(
    (repository) =>
      repository.repo_path === repoName && repositoryIndexPresentation(repository).indexed,
  );
  const authorizedRepoName = repositoryIsAvailable ? repoName : '';
  const structure = useWikiStructure(authorizedRepoName);
  const [showContents, setShowContents] = useState(false);
  const contents = useWikiContents(authorizedRepoName, showContents);
  const ask = useAskWikiQuestion(authorizedRepoName);
  const [question, setQuestion] = useState('');

  function submitQuestion() {
    const value = question.trim();
    if (!value || value.length > 4_000 || ask.isPending) return;
    ask.mutate(value);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
          <Pressable
            className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-text-hi text-text17" numberOfLines={1}>
              {repoName || 'Repository Wiki'}
            </Text>
            <Text className="text-text-low text-text12 mt-0.5">DeepWiki documentation</Text>
          </View>
        </View>

        {!isAuthenticated ? (
          <ErrorState
            title="Devin Cloud is not active"
            message="Choose Devin Cloud or Cloud + Computer as the connection mode to read repository documentation."
          />
        ) : !repoName ? (
          <ErrorState
            title="Repository unavailable"
            message="Choose an indexed repository from Repositories & Wiki."
          />
        ) : repositories.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={tokens.brand.hex} />
          </View>
        ) : repositories.error || !repositoryIsAvailable ? (
          <ErrorState
            title="Repository unavailable"
            message="Choose a repository returned by this Devin Cloud connection."
            onRetry={() => repositories.refetch()}
          />
        ) : (
          <ScrollView
            className="flex-1 px-4"
            contentContainerClassName="py-4 pb-10"
            keyboardShouldPersistTaps="handled"
          >
            <View className="bg-tint-blue rounded-card px-3 py-2 mb-4">
              <Text className="text-brand-text text-text12 leading-4">
                Documentation and answers are read through Devin's official MCP. DevinX does not
                generate, regenerate, or change repository indexing.
              </Text>
            </View>

            <Text className="text-text-hi text-text16 font-medium mb-2">Documentation topics</Text>
            {structure.isLoading && (
              <View className="items-center py-8">
                <ActivityIndicator color={tokens.brand.hex} />
              </View>
            )}
            {structure.error && (
              <View className="bg-surface1 rounded-card border border-border-subtle p-4 mb-4">
                <Text className="text-text-hi text-text14 mb-2">Wiki unavailable</Text>
                <Text className="text-text-low text-text12 leading-4 mb-3">
                  This repository may not have generated documentation, or this credential may not
                  have access.
                </Text>
                <Pressable
                  className="self-start bg-brand rounded-button px-4 py-2"
                  onPress={() => structure.refetch()}
                >
                  <Text className="text-text-always-white text-text13 font-medium">Try again</Text>
                </Pressable>
              </View>
            )}
            {structure.data && (
              <View className="bg-surface1 rounded-card border border-border-subtle p-4 mb-4">
                <DevinMarkdown>{structure.data}</DevinMarkdown>
              </View>
            )}

            <Pressable
              className="flex-row items-center justify-center min-h-11 rounded-button bg-tint-blue mb-4"
              onPress={() => setShowContents(true)}
              disabled={showContents}
              accessibilityRole="button"
              accessibilityLabel="Load full Wiki documentation"
            >
              <Ionicons name="book-outline" size={16} color={tokens.brandText.hex} />
              <Text className="text-brand-text text-text14 font-medium ml-2">
                {showContents ? 'Documentation loaded' : 'Read full documentation'}
              </Text>
            </Pressable>

            {contents.isLoading && (
              <View className="items-center py-8">
                <ActivityIndicator color={tokens.brand.hex} />
              </View>
            )}
            {contents.error && (
              <View className="bg-surface1 rounded-card border border-border-subtle p-4 mb-4">
                <Text className="text-text-low text-text13">
                  Full documentation could not be loaded for this repository.
                </Text>
              </View>
            )}
            {contents.data && (
              <View className="bg-surface1 rounded-card border border-border-subtle p-4 mb-5">
                <DevinMarkdown>{contents.data}</DevinMarkdown>
              </View>
            )}

            <Text className="text-text-hi text-text16 font-medium mb-2">Ask Devin</Text>
            <View className="bg-surface1 rounded-card border border-border-subtle p-3 mb-3">
              <TextInput
                className="text-text-hi text-text14 min-h-20"
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask a question about this repository…"
                placeholderTextColor={tokens.textLow.hex}
                multiline
                maxLength={4_000}
                textAlignVertical="top"
                accessibilityLabel="Question about repository Wiki"
              />
              <View className="flex-row justify-end mt-2">
                <Pressable
                  className={`w-11 h-11 rounded-full items-center justify-center ${question.trim() && !ask.isPending ? 'bg-brand' : 'bg-tint-secondary'}`}
                  onPress={submitQuestion}
                  disabled={!question.trim() || ask.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Ask Devin about this repository"
                >
                  {ask.isPending ? (
                    <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={question.trim() ? tokens.textAlwaysWhite.hex : tokens.textLow.hex}
                    />
                  )}
                </Pressable>
              </View>
            </View>
            {ask.error && (
              <Text className="text-failed text-text12 mb-3">
                Devin could not answer this repository question right now.
              </Text>
            )}
            {ask.data && (
              <View className="bg-surface1 rounded-card border border-border-subtle p-4">
                <DevinMarkdown>{ask.data}</DevinMarkdown>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
