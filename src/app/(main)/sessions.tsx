import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@theme/index';
import {
  computerSessionAccessQueryKey,
  useComputerSessions,
  type ComputerSessionListItem,
} from '@api/bridge/queries';
import { computerBridgePresentationQueryKey } from '@api/bridge/presentation';
import {
  ComputerDiscoveryNotices,
  ComputerListFreshness,
  ComputerSessionRow,
} from '@components/sessions/ComputerSessionRow';
import { useConnections } from '@auth/ConnectionContext';
import { hapticLight } from '@lib/haptics';

export default function SessionsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const sessionsQuery = useComputerSessions();
  const { computers, connectionError, refreshComputers } = useConnections();
  const [search, setSearch] = useState('');

  const sessions = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase();
    const items = sessionsQuery.data?.sessions ?? [];
    if (!searchTerm) return items;
    return items.filter(
      (session) =>
        session.workspaceName.toLocaleLowerCase().includes(searchTerm) ||
        (session.title ?? '').toLocaleLowerCase().includes(searchTerm) ||
        session.computerName.toLocaleLowerCase().includes(searchTerm),
    );
  }, [search, sessionsQuery.data?.sessions]);
  const localConnectionBlocked =
    (sessionsQuery.data?.computers.length ?? 0) > 0 &&
    sessionsQuery.data?.computers.every((computer) => computer.state !== 'ready') === true;

  const refreshAll = useCallback(() => {
    Promise.all([
      sessionsQuery.refetch(),
      refreshComputers(),
      queryClient.invalidateQueries({ queryKey: computerBridgePresentationQueryKey }),
      queryClient.invalidateQueries({ queryKey: computerSessionAccessQueryKey }),
    ]).catch(() => {});
  }, [queryClient, refreshComputers, sessionsQuery]);

  const openSession = useCallback(
    (session: ComputerSessionListItem) => {
      if (!session.canLoad) return;
      hapticLight();
      router.push({
        pathname: '/(main)/computer-session/[bridgeId]/[id]',
        params: { bridgeId: session.bridgeId, id: session.id },
      });
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text20 flex-1">Sessions</Text>
      </View>

      <View className="px-5 pb-3">
        <View className="flex-row items-center bg-surface1 rounded-input px-4 py-2.5 border border-border-subtle">
          <Ionicons name="search-outline" size={16} color={tokens.textLow.hex} />
          <TextInput
            className="flex-1 text-text14 text-text-hi ml-2"
            value={search}
            onChangeText={setSearch}
            placeholder="Search sessions…"
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search local sessions"
          />
        </View>
      </View>

      {connectionError && (
        <View className="mx-5 mb-3 rounded-card bg-tint-red px-3 py-2">
          <Text className="text-failed text-text12">{connectionError}</Text>
        </View>
      )}

      <FlatList
        className="flex-1 px-5"
        contentContainerClassName="pb-6 flex-grow"
        data={sessions}
        keyExtractor={(session) => `${session.bridgeId}:${session.id}`}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isRefetching}
            onRefresh={refreshAll}
            tintColor={tokens.brand.hex}
          />
        }
        ListHeaderComponent={
          <View>
            <ComputerDiscoveryNotices computers={sessionsQuery.data?.computers ?? []} />
            <ComputerListFreshness lastSuccessfulAt={sessionsQuery.data?.lastSuccessfulAt} />
            {sessions.length > 0 && (
              <Text className="py-2 text-text-low text-text12 font-medium uppercase tracking-wider">
                Local ({sessions.length})
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-4 py-10">
            {sessionsQuery.isLoading ? (
              <ActivityIndicator size="large" color={tokens.brand.hex} />
            ) : (
              <>
                <Ionicons
                  name={sessionsQuery.isError ? 'alert-circle-outline' : 'chatbubbles-outline'}
                  size={28}
                  color={tokens.textLow.hex}
                />
                <Text className="mt-3 text-center text-text-hi text-text16 font-medium">
                  {sessionsQuery.isError || localConnectionBlocked
                    ? 'Local sessions unavailable'
                    : search.trim()
                      ? 'No matching sessions'
                      : computers.length === 0
                        ? 'Pair a computer to see local sessions'
                        : 'No local sessions yet'}
                </Text>
                <Text className="mt-2 text-center text-text-mid text-text13 leading-5">
                  {sessionsQuery.isError || localConnectionBlocked
                    ? 'Fix the connection above, then pull down to refresh.'
                    : search.trim()
                      ? 'Try a different search.'
                      : computers.length === 0
                        ? 'Use Your computer in the menu to pair a computer.'
                        : `Start or resume a Devin for Terminal session on ${computers[0]?.computerName ?? 'your computer'}.`}
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ComputerSessionRow
            session={item}
            showComputerName={(sessionsQuery.data?.computers.length ?? 0) > 1}
            onPress={() => openSession(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}
