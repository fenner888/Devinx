/** Welcome screen — spec §7.1 orientation page 1. */
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { OnboardingProgress } from '@components/onboarding/OnboardingProgress';
import { branding } from '@lib/branding';
import { useTheme } from '@theme/index';
import WORDMARK_DARK from '../../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../../assets/wordmark-light.png';

export default function WelcomeScreen() {
  const router = useRouter();
  const { name } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-6 pt-4 pb-4 flex-grow"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center min-h-80">
          <View className="items-center justify-center h-52" accessibilityElementsHidden>
            <Image
              source={name === 'light' ? WORDMARK_LIGHT : WORDMARK_DARK}
              className="w-60 h-16"
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>

          <Text className="text-text-hi-strong text-text28 font-semibold mt-2">
            Run Devin from anywhere.
          </Text>
          <Text className="text-text-mid text-text16 leading-6 mt-3">
            Start and steer cloud sessions, or securely pair a computer you control—all from your
            iPhone.
          </Text>

          <View className="flex-row flex-wrap gap-2 mt-5">
            <View className="flex-row items-center rounded-chip bg-tint-blue px-3 py-2">
              <View className="w-2 h-2 rounded-dot bg-finished mr-2" />
              <Text className="text-text-mid text-text12">Cloud + Computer</Text>
            </View>
            <View className="flex-row items-center rounded-chip bg-tint-purple px-3 py-2">
              <View className="w-2 h-2 rounded-dot bg-merged mr-2" />
              <Text className="text-text-mid text-text12">On-device voice</Text>
            </View>
          </View>
        </View>

        <View className="mt-8">
          <OnboardingProgress current={1} total={3} />
          <Pressable
            className="min-h-14 bg-brand rounded-button items-center justify-center mt-5"
            onPress={() => router.push('/(onboarding)/features')}
            accessibilityRole="button"
            accessibilityLabel="Get started with DevinX"
          >
            <Text className="text-text-always-white text-text16 font-semibold">Get started</Text>
          </Pressable>

          <Text className="text-text-low text-text11 text-center leading-4 mt-4 px-3">
            {branding.disclaimer}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
