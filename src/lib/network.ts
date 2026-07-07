/**
 * Network status hook — tracks online/offline state and shows a retry banner.
 */

import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): { isOnline: boolean; wasOffline: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const onlineRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      if (!online && onlineRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setWasOffline(true);
      }
      if (online && !onlineRef.current) {
        // Came back online — keep wasOffline true so UI can show "reconnected" briefly.
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setWasOffline(false), 3000);
      }
      onlineRef.current = online;
      setIsOnline(online);
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isOnline, wasOffline };
}
