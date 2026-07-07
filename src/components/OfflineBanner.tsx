/**
 * OfflineBanner — shows when network is unavailable or recently reconnected.
 */

import { View, Text } from 'react-native';
import { useNetworkStatus } from '@lib/network';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (!isOnline) {
    return (
      <View className="bg-failed px-4 py-2">
        <Text className="text-text-always-white text-text13 text-center">
          You're offline. Some features may be unavailable.
        </Text>
      </View>
    );
  }

  if (wasOffline) {
    return (
      <View className="bg-finished px-4 py-2">
        <Text className="text-text-always-white text-text13 text-center">
          Back online.
        </Text>
      </View>
    );
  }

  return null;
}
