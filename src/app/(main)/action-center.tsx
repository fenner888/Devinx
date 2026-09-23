import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useComputerSessions } from '@api/bridge/queries';
import { useSessions } from '@api/devin/queries';
import { useConnections } from '@auth/ConnectionContext';
import { deriveActionCenterItems, type ActionCenterKind } from '@lib/action-center';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

const ICONS: Record<ActionCenterKind, keyof typeof Ionicons.glyphMap> = {
  input: 'chatbubble-ellipses-outline',
  approval: 'checkmark-done-outline',
  problem: 'alert-circle-outline',
  completed: 'checkmark-circle-outline',
  localDevice: 'desktop-outline',
};

export default function ActionCenterScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { hasCloudConnection } = useConnections();
  // Action Center summarizes every configured source, even when the home
  // board is temporarily filtered to Local-only.
  const cloud = useSessions('board', true);
  // Paired-device health remains actionable even when the home screen is
  // currently showing Cloud-only sessions.
  const computer = useComputerSessions(true);
  const watched = useAppPreferences((state) => state.watchedSessionIds);
  const acknowledged = useAppPreferences((state) => state.acknowledgedActionIds);
  const acknowledge = useAppPreferences((state) => state.acknowledgeAction);
  const items = deriveActionCenterItems({
    cloudSessions: hasCloudConnection ? cloud.data : [],
    computerStatuses: computer.data?.computers,
    watchedSessionIds: watched,
    acknowledgedActionIds: acknowledged,
  });
  const loading = (hasCloudConnection && cloud.isLoading) || computer.isLoading;
  const refreshFailed = (hasCloudConnection && cloud.isError) || computer.isError;

  function retryConfiguredSources() {
    if (hasCloudConnection) cloud.refetch();
    computer.refetch();
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
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
          <Text className="text-text-hi text-text20">Action Center</Text>
          <Text className="text-text-low text-text12 mt-0.5">
            Authorized work that may need you
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        <View className="bg-tint-blue rounded-card px-4 py-3 mb-5 flex-row">
          <Ionicons name="layers-outline" size={18} color={tokens.brandText.hex} />
          <Text className="text-brand-text text-text12 leading-4 flex-1 ml-2">
            This inbox is derived on your device from Cloud session status and signed Connector
            health. Dismissal is local and does not change a Devin session.
          </Text>
        </View>

        {refreshFailed && (
          <View className="bg-tint-red rounded-card px-4 py-3 mb-5 flex-row items-center">
            <Ionicons name="alert-circle-outline" size={18} color={tokens.failed.hex} />
            <Text className="text-failed text-text12 leading-4 flex-1 ml-2">
              One or more configured sources could not be refreshed. Existing authorized items are
              still shown; check Cloud credentials or local-device reachability and try again.
            </Text>
            <Pressable
              className="rounded-button bg-tint-secondary px-3 py-2 ml-3"
              onPress={retryConfiguredSources}
              accessibilityRole="button"
              accessibilityLabel="Retry Action Center refresh"
            >
              <Text className="text-text-hi text-text12 font-medium">Retry</Text>
            </Pressable>
          </View>
        )}

        {loading && items.length === 0 ? (
          <ActivityIndicator className="mt-12" size="large" color={tokens.brand.hex} />
        ) : items.length === 0 ? (
          <View className="items-center px-6 py-16">
            <Ionicons
              name={refreshFailed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={36}
              color={refreshFailed ? tokens.failed.hex : tokens.finished.hex}
            />
            <Text className="text-text-hi text-text17 mt-4">
              {refreshFailed ? 'Attention status unavailable' : 'Nothing needs attention'}
            </Text>
            <Text className="text-text-low text-text13 text-center mt-2 leading-5">
              {refreshFailed
                ? 'No current attention items could be confirmed because a configured source did not refresh.'
                : 'Waiting sessions, approvals, account limits, watched completions, and unreachable paired local devices appear here.'}
            </Text>
          </View>
        ) : (
          <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden">
            {items.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row items-center px-4 py-4 ${index < items.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <Pressable
                  className="flex-1 flex-row items-center"
                  onPress={() => router.push(item.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.detail}`}
                >
                  <View
                    className={`w-9 h-9 rounded-button items-center justify-center mr-3 ${
                      item.kind === 'problem'
                        ? 'bg-tint-red'
                        : item.kind === 'completed'
                          ? 'bg-tint-green'
                          : 'bg-tint-blue'
                    }`}
                  >
                    <Ionicons
                      name={ICONS[item.kind]}
                      size={17}
                      color={
                        item.kind === 'problem'
                          ? tokens.failed.hex
                          : item.kind === 'completed'
                            ? tokens.finished.hex
                            : tokens.brandText.hex
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-hi text-text14 font-medium" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-text-low text-text12 mt-0.5" numberOfLines={2}>
                      {item.detail}
                    </Text>
                  </View>
                </Pressable>
                {item.kind !== 'localDevice' && (
                  <Pressable
                    className="p-2 ml-2"
                    onPress={() => acknowledge(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss ${item.title} from this device`}
                  >
                    <Ionicons name="close" size={17} color={tokens.textLow.hex} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
