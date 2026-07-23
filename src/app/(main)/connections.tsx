import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIntegrationCatalog } from '@api/devin/mcpQueries';
import type { IntegrationCatalogItem } from '@api/devin/mcp';
import { useAuth } from '@auth/AuthContext';
import { ErrorState } from '@components/Skeletons';
import { useTheme } from '@theme/index';

type CatalogTab = 'integration' | 'mcp';

function statusLabel(status: IntegrationCatalogItem['status']): string {
  if (status === 'installed') return 'Installed';
  if (status === 'not_installed') return 'Not installed';
  return 'Status unavailable';
}

export default function ConnectionsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { isAuthenticated } = useAuth();
  const catalog = useIntegrationCatalog();
  const [tab, setTab] = useState<CatalogTab>('integration');
  const [search, setSearch] = useState('');

  const source = tab === 'integration' ? catalog.data?.integrations : catalog.data?.mcpServers;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(source ?? [])]
      .filter(
        (item) =>
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query),
      )
      .sort((left, right) => {
        const statusDifference =
          Number(right.status === 'installed') - Number(left.status === 'installed');
        return statusDifference || left.name.localeCompare(right.name);
      });
  }, [search, source]);

  if (!isAuthenticated) {
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
          <Text className="text-text-hi text-text17">Connections & MCP</Text>
        </View>
        <ErrorState
          title="Devin Cloud is not active"
          message="Choose Devin Cloud or Cloud + Local as the connection mode to inspect organization integrations."
        />
      </SafeAreaView>
    );
  }

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
          <Text className="text-text-hi text-text17">Connections & MCP</Text>
          <Text className="text-text-low text-text12 mt-0.5">Organization capability status</Text>
        </View>
      </View>

      <View className="px-4 pt-3">
        <View className="bg-tint-blue rounded-card px-3 py-2 mb-3">
          <Text className="text-brand-text text-text12 leading-4">
            DevinX can inspect the integrations available to this organization. Installation, OAuth,
            and secret configuration stay hidden because the documented interface is read-only.
          </Text>
        </View>
        <View className="flex-row bg-tint-secondary rounded-button p-1 mb-3">
          {(
            [
              { key: 'integration', label: 'Integrations' },
              { key: 'mcp', label: 'MCP servers' },
            ] as const
          ).map(({ key, label }) => (
            <Pressable
              key={key}
              className={`flex-1 rounded-button py-2 ${tab === key ? 'bg-surface2' : ''}`}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Text
                className={`text-center text-text14 ${tab === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
          <Ionicons name="search-outline" size={15} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tab === 'integration' ? 'integrations' : 'MCP servers'}…`}
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={`Search ${tab === 'integration' ? 'integrations' : 'MCP servers'}`}
          />
        </View>
      </View>

      {catalog.isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
        </View>
      )}

      {catalog.error && !catalog.data && (
        <ErrorState
          title="Connections unavailable"
          message="This Devin credential may not have access to organization integrations and MCP servers."
          onRetry={() => catalog.refetch()}
        />
      )}

      {!catalog.isLoading && catalog.data && filtered.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="extension-puzzle-outline" size={28} color={tokens.textLow.hex} />
          <Text className="text-text-hi text-text16 text-center mt-3">
            {search
              ? 'No matches'
              : `No ${tab === 'integration' ? 'integrations' : 'MCP servers'} returned`}
          </Text>
          <Text className="text-text-low text-text13 text-center mt-2 leading-5">
            {search
              ? 'Try a different search.'
              : 'The connected Devin principal may not have permission to view this catalog.'}
          </Text>
        </View>
      )}

      {filtered.length > 0 && (
        <ScrollView
          className="flex-1 px-4 pt-3"
          contentContainerClassName="pb-8"
          refreshControl={
            <RefreshControl
              refreshing={catalog.isRefetching}
              onRefresh={() => catalog.refetch()}
              tintColor={tokens.brand.hex}
            />
          }
        >
          <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden">
            {filtered.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row items-center px-4 py-3 ${index < filtered.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <View className="w-9 h-9 rounded-button bg-tint-blue items-center justify-center mr-3">
                  <Ionicons
                    name={item.kind === 'mcp' ? 'extension-puzzle-outline' : 'git-network-outline'}
                    size={16}
                    color={tokens.brandText.hex}
                  />
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-text-hi text-text14">{item.name}</Text>
                  {item.description && (
                    <Text className="text-text-low text-text12 mt-0.5" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <View
                  className={
                    item.status === 'installed'
                      ? 'bg-tint-green rounded-chip px-2 py-1'
                      : 'bg-tint-secondary rounded-chip px-2 py-1'
                  }
                >
                  <Text
                    className={
                      item.status === 'installed'
                        ? 'text-finished text-text11'
                        : 'text-text-mid text-text11'
                    }
                  >
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
