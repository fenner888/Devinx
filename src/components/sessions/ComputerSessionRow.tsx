import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { ComputerDiscoveryStatus, ComputerSessionListItem } from '@api/bridge/queries';
import { relativeTime } from '@lib/session-utils';
import { useTheme } from '@theme/index';

function sessionTime(updatedAt: string | undefined): string | null {
  if (!updatedAt) return null;
  const milliseconds = Date.parse(updatedAt);
  if (!Number.isFinite(milliseconds)) return null;
  return relativeTime(milliseconds / 1_000);
}

export function ComputerSessionRow({
  session,
  compact = false,
}: {
  session: ComputerSessionListItem;
  compact?: boolean;
}) {
  const { tokens } = useTheme();
  const time = sessionTime(session.updatedAt);
  const primaryText = session.title ?? session.workspaceName;
  const titleIsHidden = session.hasTitle && !session.title;
  const detailText = session.title
    ? session.workspaceName
    : titleIsHidden
      ? 'Session title hidden'
      : 'Local session';

  return (
    <View
      className={`flex-row items-center bg-surface1 rounded-card border border-border-subtle px-4 ${compact ? 'py-3' : 'py-3.5'} mb-2`}
      accessible
      accessibilityLabel={`${primaryText}, on ${session.computerName}, ${detailText}${time ? `, ${time}` : ''}`}
    >
      <View className="w-8 h-8 rounded-card bg-tint-blue items-center justify-center mr-3">
        <Ionicons name="desktop-outline" size={15} color={tokens.brandText.hex} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={1}>
          {primaryText}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-brand-text text-text12" numberOfLines={1}>
            {session.computerName}
          </Text>
          <Text className="text-text-low text-text12 mx-1.5">·</Text>
          <Text className="text-text-low text-text12 flex-1" numberOfLines={1}>
            {detailText}
          </Text>
          {time && <Text className="text-text-low text-text12 ml-2">{time}</Text>}
        </View>
      </View>
    </View>
  );
}

function discoveryMessage(status: ComputerDiscoveryStatus): string | null {
  if (status.state === 'ready') return null;
  if (status.state === 'session_discovery_off') {
    return `${status.computerName} is paired. Start its bridge with Devin ACP to show sessions.`;
  }
  if (status.state === 'authorization_failed') {
    return `${status.computerName} needs to be paired again.`;
  }
  if (status.state === 'invalid_response') {
    return `${status.computerName} returned an incompatible session response.`;
  }
  return `${status.computerName} is offline or its Desktop Bridge is not running.`;
}

export function ComputerDiscoveryNotices({ computers }: { computers: ComputerDiscoveryStatus[] }) {
  const { tokens } = useTheme();
  const notices = computers.flatMap((computer) => {
    const message = discoveryMessage(computer);
    return message ? [{ key: computer.bridgeId, message }] : [];
  });
  if (notices.length === 0) return null;

  return (
    <View className="mb-2">
      {notices.map((notice) => (
        <View
          key={notice.key}
          className="flex-row items-start rounded-card border border-border-subtle bg-surface1 px-3 py-2.5 mb-2"
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="desktop-outline" size={14} color={tokens.textMid.hex} />
          <Text className="text-text-mid text-text12 ml-2 flex-1">{notice.message}</Text>
        </View>
      ))}
    </View>
  );
}
