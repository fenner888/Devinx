/**
 * Push notifications setup — registers for push tokens and handles
 * incoming notifications. Session status change notifications are
 * handled locally (foreground) and via push (background, requires server).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@devinx/push-token';

// Configure notification behavior when app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Request notification permissions. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('session-updates', {
      name: 'Session updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4489FF',
    });
  }
  return true;
}

/** Get or register the Expo push token. Returns null if not available. */
export async function getPushToken(): Promise<string | null> {
  // Check if we already have a token stored.
  const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (cached) return cached;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'devinx',
    })).data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** Add a notification response listener for deep linking to sessions. */
export function setupNotificationListener(
  onSessionNotification: (sessionId: string) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.sessionId && typeof data.sessionId === 'string') {
      onSessionNotification(data.sessionId);
    }
  });
  return () => subscription.remove();
}

/** Show a local notification for a session status change (foreground). */
export async function showSessionStatusNotification(
  sessionId: string,
  title: string,
  body: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { sessionId },
    },
    trigger: null, // immediately
  });
}
