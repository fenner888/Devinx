import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { COMPUTER_SESSIONS_REFRESH_INTERVAL_MS } from '@api/bridge/queries';
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
  showComputerName = true,
  onPress,
}: {
  session: ComputerSessionListItem;
  compact?: boolean;
  showComputerName?: boolean;
  onPress?: () => void;
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
  const modelText = session.model?.name;

  const accessibilityLabel = `${primaryText}, on ${session.computerName}, ${detailText}${modelText ? `, ${modelText}` : ''}${time ? `, ${time}` : ''}${onPress ? ', open history' : ''}`;
  const content = (
    <>
      <View className="w-8 h-8 rounded-card bg-tint-blue items-center justify-center mr-3">
        <Ionicons name="desktop-outline" size={15} color={tokens.brandText.hex} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-text-hi text-text14" numberOfLines={compact ? 1 : 2}>
          {primaryText}
        </Text>
        <View className="flex-row items-center mt-0.5">
          {showComputerName && (
            <>
              <Text className="text-brand-text text-text12" numberOfLines={1}>
                {session.computerName}
              </Text>
              <Text className="text-text-low text-text12 mx-1.5">·</Text>
            </>
          )}
          <Text className="text-text-low text-text12 flex-1" numberOfLines={1}>
            {detailText}{modelText ? ` · ${modelText}` : ''}
          </Text>
          {time && <Text className="text-text-low text-text12 ml-2">{time}</Text>}
        </View>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />}
    </>
  );

  const className = `flex-row items-center bg-surface1 rounded-card border border-border-subtle px-4 ${compact ? 'py-3' : 'py-3.5'} mb-2`;
  if (onPress) {
    return (
      <Pressable
        className={className}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View className={className} accessible accessibilityLabel={accessibilityLabel}>
      {content}
    </View>
  );
}

function discoveryMessage(status: ComputerDiscoveryStatus): string | null {
  if (status.state === 'ready') return null;
  if (status.state === 'session_discovery_off') {
    return `${status.computerName} is paired. Start its Connector with Devin ACP to show sessions.`;
  }
  if (status.state === 'authorization_failed') {
    return `${status.computerName} needs to be paired again.`;
  }
  if (status.state === 'too_many_sessions') {
    return `${status.computerName} has more sessions than DevinX can list right now, so none are shown.`;
  }
  if (status.state === 'invalid_response') {
    return `${status.computerName} returned an incompatible session response.`;
  }
  if (status.state === 'busy') {
    return `${status.computerName} is busy. Showing the last session list — pull to refresh again in a moment.`;
  }
  return `${status.computerName} is offline or DevinX Connector is not running.`;
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

export function ComputerListFreshness({ lastSuccessfulAt }: { lastSuccessfulAt?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lastSuccessfulAt === undefined) return;
    const id = setInterval(() => setTick((tick) => tick + 1), 15_000);
    return () => clearInterval(id);
  }, [lastSuccessfulAt]);

  if (lastSuccessfulAt === undefined) return null;
  return (
    <Text className="text-text-low text-text12 mb-2">
      Local list updated {relativeTime(lastSuccessfulAt / 1000)} · refreshes every{' '}
      {COMPUTER_SESSIONS_REFRESH_INTERVAL_MS / 1000}s
    </Text>
  );
}
