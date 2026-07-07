/**
 * Settings screen — minimal for Session 1.
 * Shows auth status, disconnect button (§10.5 wipe), theme toggle.
 * Full settings ship in Session 4.
 */
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { purgeCache } from '@cache/index';
import { branding } from '@lib/branding';

export default function SettingsScreen() {
  const router = useRouter();
  const { disconnect, provider } = useAuth();
  const queryClient = useQueryClient();

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
            // §10.5: wipe Keychain + SQLite cache + query cache.
            await disconnect();
            await purgeCache();
            queryClient.clear();
            router.replace('/(onboarding)');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="px-5 py-3">
        <Text className="text-text-hi text-text17">Settings</Text>
      </View>

      <View className="px-5 py-4">
        <Text className="text-text-mid text-text13 mb-1">Connected as</Text>
        <Text className="text-text-hi text-text14">
          {provider?.kind === 'pat' ? 'Personal access token' : 'Service user key'}
        </Text>
      </View>

      <View className="px-5 py-4">
        <Text className="text-text-mid text-text13 mb-1">Product</Text>
        <Text className="text-text-hi text-text14">{branding.name}</Text>
        <Text className="text-text-low text-text12 mt-1">{branding.disclaimer}</Text>
      </View>

      <View className="px-5 mt-8">
        <Pressable
          className="bg-destructive rounded-button px-buttonPrimaryX py-buttonPrimaryY items-center"
          onPress={handleDisconnect}
        >
          <Text className="text-text-always-white text-text14 font-medium">
            Disconnect & wipe data
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
