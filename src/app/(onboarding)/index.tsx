/**
 * Welcome screen — spec §7.1 step 1.
 * Value prop, disclaimer footer (§1.4), "Connect your Devin account" CTA.
 */
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { branding } from '@lib/branding';
import { useTheme } from '@theme/index';
import WORDMARK_DARK from '../../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../../assets/wordmark-light.png';

export default function WelcomeScreen() {
  const router = useRouter();
  const { name } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6">
        {/* DevinX wordmark */}
        <Image
          source={name === 'light' ? WORDMARK_LIGHT : WORDMARK_DARK}
          className="w-56 h-14 mb-4"
          resizeMode="contain"
          accessibilityLabel={branding.name}
        />
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
