import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRepositories } from '@api/devin/queries';
import { repositoryIndexPresentation } from '@lib/repository-indexing';
import { EmptyState, ErrorState } from '@components/Skeletons';
import { useTheme } from '@theme/index';

export default function RepositoriesScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const repositories = useRepositories();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(repositories.data ?? [])]
      .filter(
        (repository) =>
          !query ||
          repository.repo_path.toLowerCase().includes(query) ||
          (repository.repo_language ?? '').toLowerCase().includes(query),
      )
      .sort((left, right) => {
        const indexDifference =
          Number(repositoryIndexPresentation(right).indexed) -
          Number(repositoryIndexPresentation(left).indexed);
        return indexDifference || left.repo_path.localeCompare(right.repo_path);
      });
  }, [repositories.data, search]);

  const indexedCount = (repositories.data ?? []).filter(
    (repository) => repositoryIndexPresentation(repository).indexed,
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
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
          <Text className="text-text-hi text-text17">Repositories & Wiki</Text>
          {repositories.data && (
            <Text className="text-text-low text-text12 mt-0.5">
              {indexedCount} of {repositories.data.length} indexed
            </Text>
          )}
        </View>
      </View>

      <View className="px-4 pt-3">
        <View className="bg-tint-blue rounded-card px-3 py-2 mb-3">
          <Text className="text-brand-text text-text12">
            Read-only repository and DeepWiki index status from Devin Cloud. Indexing changes stay
            in Devin Web until a separate permissioned workflow is approved.
          </Text>
        </View>
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search repositories…"
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search repositories"
          />
        </View>
      </View>

      {repositories.isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {repositories.error && !repositories.data && (
        <ErrorState
          title="Repositories unavailable"
          message="This Cloud connection may not have permission to read repository status."
          onRetry={() => repositories.refetch()}
        />
      )}

      {!repositories.isLoading && repositories.data && filtered.length === 0 && (
        <EmptyState
          icon=">_"
          title={search ? 'No matches' : 'No repositories available'}
          message={
            search
              ? 'No repositories match your search.'
              : 'Connect or grant repositories in Devin before they can appear here.'
          }
        />
      )}

      {filtered.length > 0 && (
        <ScrollView
          className="flex-1 px-4 pt-3"
          contentContainerClassName="pb-8"
          refreshControl={
            <RefreshControl
              refreshing={repositories.isRefetching}
              onRefresh={() => repositories.refetch()}
              tintColor={tokens.brand.hex}
            />
          }
        >
          <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden">
            {filtered.map((repository, index) => {
              const status = repositoryIndexPresentation(repository);
              return (
                <View
                  key={`${repository.git_connection_id}:${repository.provider_repository_id}`}
                  className={`flex-row items-center px-4 py-3 ${index < filtered.length - 1 ? 'border-b border-border-subtle' : ''}`}
                  accessibilityLabel={`${repository.repo_path}, ${status.label}${status.detail ? `, ${status.detail}` : ''}`}
                >
                  <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
                    <Ionicons name="folder-outline" size={15} color={tokens.brandText.hex} />
                  </View>
                  <View className="flex-1 mr-3">
                    <Text className="text-text-hi text-text14" numberOfLines={1}>
                      {repository.repo_path}
                    </Text>
                    <Text className="text-text-low text-text12 mt-0.5" numberOfLines={1}>
                      {[repository.repo_language, status.detail].filter(Boolean).join(' · ') ||
                        'Repository available'}
                    </Text>
                  </View>
                  <View className={status.indexed ? 'bg-tint-green rounded-chip px-2 py-1' : 'bg-tint-secondary rounded-chip px-2 py-1'}>
                    <Text className={status.indexed ? 'text-finished text-text11' : 'text-text-mid text-text11'}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
