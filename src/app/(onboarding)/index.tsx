/**
 * Welcome screen — spec §7.1 step 1.
 * Value prop, disclaimer footer (§1.4), "Connect your Devin account" CTA.
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { branding } from '@lib/branding';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6">
        {/* Terminal-prompt motif (parity-delta #2: visual anchor for touch-first) */}
        <View className="mb-8 items-center">
          <Text className="font-mono text-text14 text-brand">{'>_'}</Text>
        </View>

        <Text className="text-text-hi text-text17 text-center mb-2">{branding.name}</Text>
        <Text className="text-text-mid text-text14 text-center mb-8">
          {branding.subtitle}
        </Text>

        <View className="w-full max-w-sm mb-8">
          <Text className="text-text-mid text-text13 text-center leading-5">
            Mission control for your Devin sessions. See what needs your attention,
            steer active work, and ship PRs — all from your phone.
          </Text>
        </View>

        <Pressable
          className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY"
          onPress={() => router.push('/(onboarding)/credentials')}
        >
          <Text className="text-text-always-white text-text14 font-medium">
            Connect your Devin account
          </Text>
        </Pressable>

        {/* Disclaimer footer (§1.4) */}
        <View className="mt-12 px-4">
          <Text className="text-text-low text-text12 text-center leading-4">
            {branding.disclaimer}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
