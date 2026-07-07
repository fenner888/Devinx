/**
 * Network status hook — tracks online/offline state and shows a retry banner.
 */

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): { isOnline: boolean; wasOffline: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      if (!online && isOnline) {
        setWasOffline(true);
      }
      if (online && !isOnline) {
        // Came back online — keep wasOffline true so UI can show "reconnected" briefly.
        setTimeout(() => setWasOffline(false), 3000);
      }
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [isOnline]);

  return { isOnline, wasOffline };
}
