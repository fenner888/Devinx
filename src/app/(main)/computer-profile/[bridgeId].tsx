import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useComputerSessionAccess, useComputerSessions } from '@api/bridge/queries';
import { useConnections } from '@auth/ConnectionContext';
import { computerTransportLabel } from '@auth/pairedComputers';
import { useTheme } from '@theme/index';

const GRANT_LABELS: Record<string, string> = {
  'bridge:health': 'Read Connector health',
  'session:metadata:read': 'Read session titles and metadata',
  'session:content:read': 'Read session history',
  'session:prompt:send': 'Send steering messages',
};

export default function ComputerProfileScreen() {
  const params = useLocalSearchParams<{ bridgeId?: string | string[] }>();
  const bridgeId = Array.isArray(params.bridgeId) ? params.bridgeId[0] : params.bridgeId;
  const router = useRouter();
  const { tokens } = useTheme();
  const { computers } = useConnections();
  const computer = computers.find((item) => item.bridgeId === bridgeId);
  const health = useComputerSessionAccess(computer?.bridgeId ?? '', Boolean(computer?.bridgeId));
  // A paired-device profile remains inspectable even while Cloud is the active home mode.
  const board = useComputerSessions(true);
  const workspaces = [
    ...new Set(
      (board.data?.sessions ?? [])
        .filter((session) => session.bridgeId === bridgeId)
        .map((session) => session.workspaceName),
    ),
  ].sort((left, right) => left.localeCompare(right));

  if (!computer) {
    return (
      <SafeAreaView className="flex-1 bg-surface0 items-center justify-center px-8">
        <Ionicons name="desktop-outline" size={34} color={tokens.textLow.hex} />
        <Text className="text-text-hi text-text17 mt-4">Local device not paired</Text>
        <Text className="text-text-low text-text13 text-center mt-2">
          This iPhone no longer has a secure credential for that local device.
        </Text>
        <Pressable className="bg-brand rounded-button px-4 py-3 mt-5" onPress={() => router.back()}>
          <Text className="text-text-always-white text-text13 font-medium">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const capabilities = health.data?.capabilities;
  const capabilityRows = [
    ['Discover sessions', capabilities?.sessionList],
    ['Load session history', capabilities?.sessionLoad],
    ['Steer sessions', capabilities?.sessionPrompt],
  ] as const;

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
          <Text className="text-text-hi text-text20" numberOfLines={1}>
            {computer.computerName}
          </Text>
          <Text className="text-text-low text-text12 mt-0.5">Local device profile</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-5">
          <InfoRow
            icon="shield-checkmark-outline"
            label="Private transport"
            value={computerTransportLabel(computer.transportKind)}
          />
          <InfoRow
            icon="time-outline"
            label="Paired"
            value={new Date(computer.pairedAt).toLocaleDateString()}
            last
          />
        </View>

        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Live health</Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-5">
          <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
            <Ionicons
              name={health.data ? 'checkmark-circle' : health.isLoading ? 'sync' : 'alert-circle'}
              size={18}
              color={
                health.data
                  ? tokens.finished.hex
                  : health.isLoading
                    ? tokens.textMid.hex
                    : tokens.failed.hex
              }
            />
            <Text className="text-text-hi text-text14 flex-1 ml-3">Connector</Text>
            {health.isLoading ? (
              <ActivityIndicator size="small" color={tokens.brand.hex} />
            ) : (
              <Text className={`text-text12 ${health.data ? 'text-finished' : 'text-failed'}`}>
                {health.data ? 'Reachable' : 'Unavailable'}
              </Text>
            )}
          </View>
          {capabilityRows.map(([label, enabled], index) => (
            <View
              key={label}
              className={`flex-row items-center px-4 py-3 ${index < capabilityRows.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <Ionicons
                name={enabled ? 'checkmark' : 'remove'}
                size={17}
                color={enabled ? tokens.finished.hex : tokens.textLow.hex}
              />
              <Text className="text-text-hi text-text14 flex-1 ml-3">{label}</Text>
              <Text className="text-text-low text-text12">
                {health.data ? (enabled ? 'Advertised' : 'Not advertised') : 'Unknown'}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-text-low text-text12 font-medium uppercase mb-2">iPhone grants</Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-5">
          {computer.permissions.map((permission, index) => (
            <View
              key={permission}
              className={`flex-row items-center px-4 py-3 ${index < computer.permissions.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <Ionicons name="checkmark-circle-outline" size={17} color={tokens.finished.hex} />
              <Text className="text-text-hi text-text14 flex-1 ml-3">
                {GRANT_LABELS[permission] ?? permission}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-text-low text-text12 font-medium uppercase mb-2">
          Observed workspaces
        </Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-5">
          {board.isLoading ? (
            <ActivityIndicator className="my-5" size="small" color={tokens.brand.hex} />
          ) : board.isError ? (
            <Text className="text-text-low text-text13 px-4 py-4 leading-5">
              Workspace metadata could not be refreshed for this device.
            </Text>
          ) : workspaces.length > 0 ? (
            workspaces.map((workspace, index) => (
              <View
                key={workspace}
                className={`flex-row items-center px-4 py-3 ${index < workspaces.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <Ionicons name="folder-outline" size={17} color={tokens.textMid.hex} />
                <Text className="text-text-hi text-text14 flex-1 ml-3" numberOfLines={1}>
                  {workspace}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-text-low text-text13 px-4 py-4 leading-5">
              No workspace names are available from authorized session metadata for this device.
            </Text>
          )}
        </View>

        <View className="bg-tint-blue rounded-card px-4 py-3 flex-row">
          <Ionicons name="information-circle-outline" size={18} color={tokens.brandText.hex} />
          <Text className="text-brand-text text-text12 leading-4 flex-1 ml-2">
            Models, modes, repository creation, MCP, and environment mutation remain hidden until
            this Connector advertises a versioned, signed capability with a matching device grant.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      className={`flex-row items-center px-4 py-3 ${last ? '' : 'border-b border-border-subtle'}`}
    >
      <Ionicons name={icon} size={17} color={tokens.textMid.hex} />
      <Text className="text-text-hi text-text14 flex-1 ml-3">{label}</Text>
      <Text className="text-text-low text-text12">{value}</Text>
    </View>
  );
}
