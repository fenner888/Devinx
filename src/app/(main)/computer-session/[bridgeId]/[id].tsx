import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComputerSessionDetail } from '@api/bridge/queries';
import { ComputerBridgeError, type ComputerLoadedSession } from '@auth/computerBridge';
import { useConnections } from '@auth/ConnectionContext';
import { computerTransportLabel } from '@auth/pairedComputers';
import { DevinCompanion } from '@components/pets';
import { useTheme } from '@theme/index';

const BRIDGE_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const LOCAL_SESSION_ID_PATTERN = /^local_[A-Za-z0-9_-]{43}$/;

function singleParameter(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function publicErrorMessage(error: unknown): string {
  if (!(error instanceof ComputerBridgeError)) {
    return 'The local session could not be loaded.';
  }
  if (
    error.code === 'not_paired' ||
    error.code === 'permission_denied' ||
    error.code === 'authorization_failed'
  ) {
    return 'This iPhone does not have permission to read that local session.';
  }
  if (error.code === 'invalid_response') {
    return 'The paired Mac returned an incompatible session history.';
  }
  if (error.code === 'rate_limited') {
    return 'The paired Mac is busy. Wait a moment and try again.';
  }
  return 'Start the Desktop Bridge and confirm the secure computer connection is available.';
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
    </Pressable>
  );
}

function HistoryMessage({ message }: { message: ComputerLoadedSession['messages'][number] }) {
  const isUser = message.source === 'user';
  if (isUser) {
    return (
      <View className="mb-4 max-w-[88%] self-end items-end">
        <View className="rounded-2xl bg-tint-primary px-4 py-3">
          <Text className="text-text-hi text-text14" selectable>
            {message.text}
          </Text>
        </View>
        <Text className="mt-1 text-text-low text-text11">You</Text>
      </View>
    );
  }
  return (
    <View className="mb-5">
      <Text className="text-text-hi text-text14 leading-5" selectable>
        {message.text}
      </Text>
      <Text className="mt-1.5 text-text-low text-text11">Devin</Text>
    </View>
  );
}

export default function ComputerSessionDetailScreen() {
  const parameters = useLocalSearchParams<{
    bridgeId?: string | string[];
    id?: string | string[];
  }>();
  const bridgeId = singleParameter(parameters.bridgeId);
  const sessionId = singleParameter(parameters.id);
  const router = useRouter();
  const { tokens } = useTheme();
  const { computers } = useConnections();
  const [companionActive, setCompanionActive] = useState(false);
  const validParameters =
    BRIDGE_ID_PATTERN.test(bridgeId) && LOCAL_SESSION_ID_PATTERN.test(sessionId);
  const computer = computers.find((item) => item.bridgeId === bridgeId);
  const mayReadContent =
    validParameters && Boolean(computer?.permissions.includes('session:content:read'));
  const query = useComputerSessionDetail(bridgeId, sessionId, mayReadContent);

  useFocusEffect(
    useCallback(() => {
      setCompanionActive(true);
      return () => setCompanionActive(false);
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center border-b border-border-subtle px-4 py-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 min-w-0">
          <Text className="text-text-hi text-text16" numberOfLines={1}>
            {query.data?.session.workspaceName ?? 'Computer session'}
          </Text>
          <View className="mt-0.5 flex-row items-center">
            <Ionicons name="desktop-outline" size={12} color={tokens.brandText.hex} />
            <Text className="ml-1.5 text-brand-text text-text12" numberOfLines={1}>
              {computer?.computerName ?? 'Paired Mac'}
            </Text>
            <Text className="mx-1.5 text-text-low text-text12">·</Text>
            <Text className="text-text-low text-text12">Read only</Text>
            {computer && (
              <>
                <Text className="mx-1.5 text-text-low text-text12">·</Text>
                <Text className="text-text-low text-text12">
                  {computerTransportLabel(computer.transportKind)}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {!validParameters || !computer || !mayReadContent ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="lock-closed-outline" size={28} color={tokens.textLow.hex} />
          <Text className="mt-4 text-center text-text-hi text-text16">
            Local history is not available
          </Text>
          <Text className="mt-2 text-center text-text-mid text-text13 leading-5">
            Pair this iPhone with permission to read session content, then open the session again.
          </Text>
        </View>
      ) : query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={tokens.brand.hex} />
          <Text className="mt-3 text-text-mid text-text13">Loading from your Mac…</Text>
        </View>
      ) : query.error || !query.data ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="desktop-outline" size={28} color={tokens.textLow.hex} />
          <Text className="mt-4 text-center text-text-hi text-text16">
            Could not load local history
          </Text>
          <Text className="mt-2 text-center text-text-mid text-text13 leading-5">
            {publicErrorMessage(query.error)}
          </Text>
          <Pressable
            className="mt-5 rounded-card bg-brand px-5 py-3"
            onPress={() => query.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Try loading local session again"
          >
            <Text className="text-text-always-white text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-5 pb-12"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
              tintColor={tokens.brand.hex}
            />
          }
        >
          {query.data.truncated && (
            <View className="mb-5 flex-row items-start rounded-card border border-border-subtle bg-surface1 px-3 py-3">
              <Ionicons name="information-circle-outline" size={16} color={tokens.textMid.hex} />
              <Text className="ml-2 flex-1 text-text-mid text-text12 leading-4">
                Older content was omitted to keep this private-device transfer small.
              </Text>
            </View>
          )}
          {query.data.messages.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-text-mid text-text14">No replayable text was returned.</Text>
            </View>
          ) : (
            query.data.messages.map((message) => (
              <HistoryMessage key={message.sequence} message={message} />
            ))
          )}
          <View className="items-end pt-2">
            <DevinCompanion
              state="waiting"
              size={112}
              active={companionActive}
              accessibilityLabel="Devin companion, waiting"
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
