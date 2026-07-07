/**
 * Settings screen — theme toggle, auth status, about, disconnect.
 */
import { View, Text, Pressable, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { purgeCache } from '@cache/index';
import { branding } from '@lib/branding';
import {
  setThemePreference,
  getThemePreference,
  useTheme,
  type ThemePreference,
} from '@theme/index';

export default function SettingsScreen() {
  const router = useRouter();
  const { disconnect, provider } = useAuth();
  const queryClient = useQueryClient();
  const { name } = useTheme();
  const currentPref = getThemePreference();

  async function handleDisconnect() {
    Alert.alert(
      'Disconnect?',
      'This wipes your API key, org ID, and all cached session data from this device. Your Devin sessions are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            await purgeCache();
            queryClient.clear();
            router.replace('/(onboarding)');
          },
        },
      ],
    );
  }

  function handleThemeChange(pref: ThemePreference) {
    setThemePreference(pref);
  }

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="px-5 py-3 border-b border-border-subtle">
        <Text className="text-text-hi text-text17">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-5 py-4">
        {/* Theme */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Appearance</Text>
        <View className="flex-row bg-tint-secondary rounded-button p-1 mb-6">
          {themeOptions.map(({ key, label }) => (
            <Pressable
              key={key}
              className={`flex-1 rounded-button py-2 ${currentPref === key ? 'bg-surface2' : ''}`}
              onPress={() => handleThemeChange(key)}
            >
              <Text className={`text-center text-text14 ${currentPref === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Connection */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Connection</Text>
        <View className="bg-surface1 rounded-card px-4 py-3 mb-6">
          <Text className="text-text-mid text-text13 mb-1">Connected as</Text>
          <Text className="text-text-hi text-text14">
            {provider?.kind === 'pat' ? 'Personal access token' : 'Service user key'}
          </Text>
          <Text className="text-text-low text-text12 mt-1">Active theme: {name}</Text>
        </View>

        {/* Usage link */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Usage</Text>
        <Pressable
          className="bg-surface1 rounded-card px-4 py-3 mb-6 flex-row items-center justify-between"
          onPress={() => router.push('/(main)/usage')}
        >
          <Text className="text-text-hi text-text14">View ACU consumption</Text>
          <Text className="text-text-mid text-text14">{'\u203A'}</Text>
        </Pressable>

        {/* About */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">About</Text>
        <View className="bg-surface1 rounded-card px-4 py-3 mb-6">
          <Text className="text-text-hi text-text14 mb-1">{branding.name}</Text>
          <Text className="text-text-mid text-text13 mb-3">{branding.subtitle}</Text>
          <Text className="text-text-low text-text12 leading-4 mb-3">{branding.disclaimer}</Text>
          <Pressable onPress={() => Linking.openURL(branding.links.createServiceUser)}>
            <Text className="text-link text-text13">API keys documentation →</Text>
          </Pressable>
        </View>

        {/* Disconnect */}
        <Pressable
          className="bg-destructive rounded-button px-buttonPrimaryX py-buttonPrimaryY items-center mb-8"
          onPress={handleDisconnect}
        >
          <Text className="text-text-always-white text-text14 font-medium">
            Disconnect & wipe data
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
