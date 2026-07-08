/**
 * Settings screen — grouped card sections with icon tiles, matching the
 * Devin settings design (specs/reference-ui/04-settings.png).
 * Theme toggle, auth status, usage link, about, disconnect.
 */
import { View, Text, Pressable, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { purgeCache } from '@cache/index';
import { branding } from '@lib/branding';
import { confirmAction } from '@lib/confirm';
import { useAppPreferences, type PollingMode } from '@store/preferences';
import {
  setThemePreference,
  useThemePreference,
  useTheme,
  type ThemePreference,
} from '@theme/index';

export default function SettingsScreen() {
  const router = useRouter();
  const { disconnect, provider } = useAuth();
  const queryClient = useQueryClient();
  const { name, tokens } = useTheme();
  const currentPref = useThemePreference();
  const pollingMode = useAppPreferences((s) => s.pollingMode);
  const setPollingMode = useAppPreferences((s) => s.setPollingMode);
  const hapticsEnabled = useAppPreferences((s) => s.hapticsEnabled);
  const setHaptics = useAppPreferences((s) => s.setHaptics);

  function handleDisconnect() {
    confirmAction(
      {
        title: 'Disconnect?',
        message:
          'This wipes your API key, org ID, and all cached session data from this device. Your Devin sessions are not affected.',
        confirmLabel: 'Disconnect',
        destructive: true,
      },
      async () => {
        await disconnect();
        await purgeCache();
        queryClient.clear();
        router.replace('/(onboarding)');
      },
    );
  }

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {/* Appearance */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Appearance</Text>
        <View className="flex-row bg-tint-secondary rounded-button p-1 mb-6">
          {themeOptions.map(({ key, label }) => (
            <Pressable
              key={key}
              className={`flex-1 rounded-button py-2 ${currentPref === key ? 'bg-surface2' : ''}`}
              onPress={() => setThemePreference(key)}
            >
              <Text className={`text-center text-text14 ${currentPref === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Behavior */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Behavior</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          <View className="px-4 py-3 border-b border-border-subtle">
            <Text className="text-text-hi text-text14 mb-2">Polling</Text>
            <View className="flex-row bg-tint-secondary rounded-button p-1">
              {(
                [
                  { key: 'battery_saver', label: 'Battery saver' },
                  { key: 'balanced', label: 'Balanced' },
                  { key: 'fast', label: 'Fast' },
                ] as { key: PollingMode; label: string }[]
              ).map(({ key, label }) => (
                <Pressable
                  key={key}
                  className={`flex-1 rounded-button py-2 ${pollingMode === key ? 'bg-surface2' : ''}`}
                  onPress={() => setPollingMode(key)}
                >
                  <Text className={`text-center text-text13 ${pollingMode === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-text-low text-text12 mt-2">
              How often the app refreshes sessions while open.
            </Text>
          </View>
          <Pressable
            className="flex-row items-center px-4 py-3"
            onPress={() => setHaptics(!hapticsEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: hapticsEnabled }}
            accessibilityLabel="Haptic feedback"
          >
            <View className="flex-1">
              <Text className="text-text-hi text-text14">Haptic feedback</Text>
              <Text className="text-text-low text-text12 mt-0.5">Vibrate on taps and status changes.</Text>
            </View>
            <View className={`w-12 h-7 rounded-chip p-0.5 ${hapticsEnabled ? 'bg-brand' : 'bg-tint-primary'}`}>
              <View className={`w-6 h-6 rounded-chip bg-surface2 ${hapticsEnabled ? 'ml-auto' : ''}`} />
            </View>
          </Pressable>
        </View>

        {/* Account */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Account</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
            <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
              <Ionicons name="key-outline" size={15} color={tokens.brandText.hex} />
            </View>
            <View className="flex-1">
              <Text className="text-text-hi text-text14">
                {provider?.kind === 'pat' ? 'Personal access token' : 'Service user key'}
              </Text>
              <Text className="text-text-low text-text12 mt-0.5">
                Stored in the device Keychain · Active theme: {name}
              </Text>
            </View>
          </View>
          <Pressable
            className="flex-row items-center px-4 py-3"
            onPress={() => router.push('/(main)/usage')}
            accessibilityRole="button"
            accessibilityLabel="View ACU consumption"
          >
            <View className="w-8 h-8 rounded-button bg-tint-green items-center justify-center mr-3">
              <Ionicons name="speedometer-outline" size={15} color={tokens.finished.hex} />
            </View>
            <Text className="text-text-hi text-text14 flex-1">Usage & limits</Text>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>
        </View>

        {/* Resources — mirrors the web settings tree */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Resources</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          {(
            [
              { icon: 'document-text-outline', label: 'Knowledge', route: '/(main)/knowledge', tint: 'bg-tint-purple', color: tokens.merged.hex },
              { icon: 'book-outline', label: 'Playbooks', route: '/(main)/playbooks', tint: 'bg-tint-blue', color: tokens.brandText.hex },
              { icon: 'lock-closed-outline', label: 'Secrets', route: '/(main)/secrets', tint: 'bg-tint-orange', color: tokens.blocked.hex },
              { icon: 'stats-chart-outline', label: 'Analytics', route: '/(main)/analytics', tint: 'bg-tint-green', color: tokens.finished.hex },
            ] as const
          ).map(({ icon, label, route, tint, color }, i, arr) => (
            <Pressable
              key={label}
              className={`flex-row items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border-subtle' : ''}`}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View className={`w-8 h-8 rounded-button items-center justify-center mr-3 ${tint}`}>
                <Ionicons name={icon} size={15} color={color} />
              </View>
              <Text className="text-text-hi text-text14 flex-1">{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
            </Pressable>
          ))}
        </View>

        {/* About */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">About</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-6">
          <Text className="text-text-hi text-text14 mb-1">{branding.name}</Text>
          <Text className="text-text-mid text-text13 mb-3">{branding.subtitle}</Text>
          <Text className="text-text-low text-text12 leading-4 mb-3">{branding.disclaimer}</Text>
          <Pressable onPress={() => Linking.openURL(branding.links.createServiceUser)}>
            <Text className="text-link text-text13">API keys documentation →</Text>
          </Pressable>
        </View>

        {/* Disconnect */}
        <Pressable
          className="flex-row items-center justify-center bg-destructive rounded-button px-buttonPrimaryX py-buttonPrimaryY mb-8"
          onPress={handleDisconnect}
          accessibilityRole="button"
          accessibilityLabel="Disconnect and wipe data"
        >
          <Ionicons name="log-out-outline" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text14 font-medium ml-2">
            Disconnect & wipe data
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
