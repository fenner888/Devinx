/**
 * Bottom tab bar — Home / Sessions / Automations / Settings.
 * iOS-aware: the tab bar respects the home-indicator safe area and uses a
 * translucent surface. Detail screens (session, compose, review, etc.) live
 * in the parent stack and push over the tabs.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';

type IconName = keyof typeof Ionicons.glyphMap;

/** Factory for a stable tabBarIcon renderer (avoids defining components in render). */
function tabIcon(name: IconName, delta = 1) {
  const Icon = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size - delta} color={color} />
  );
  Icon.displayName = `TabIcon(${name})`;
  return Icon;
}

const HOME_ICON = tabIcon('sparkles-outline', 2);
const SESSIONS_ICON = tabIcon('chatbubbles-outline', 1);
const AUTOMATIONS_ICON = tabIcon('time-outline', 1);
const SETTINGS_ICON = tabIcon('settings-outline', 2);

export default function TabsLayout() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.brand.hex,
        tabBarInactiveTintColor: tokens.textLow.hex,
        tabBarStyle: {
          backgroundColor: tokens.surface0.hex,
          borderTopColor: tokens.borderSubtle.hex,
          borderTopWidth: 1,
          // Respect the iOS home indicator; give Android a comfortable height.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          ...(Platform.OS === 'ios' ? { position: 'absolute' } : null),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        // Keep content clear of the absolute iOS tab bar.
        sceneStyle: { backgroundColor: tokens.surface0.hex },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: HOME_ICON }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions', tabBarIcon: SESSIONS_ICON }} />
      <Tabs.Screen name="automations" options={{ title: 'Automations', tabBarIcon: AUTOMATIONS_ICON }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: SETTINGS_ICON }} />
    </Tabs>
  );
}
