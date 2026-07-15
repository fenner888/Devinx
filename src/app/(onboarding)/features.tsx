import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { OnboardingBackButton } from '@components/onboarding/OnboardingBackButton';
import { OnboardingProgress } from '@components/onboarding/OnboardingProgress';
import { useTheme } from '@theme/index';

const FEATURES: ReadonlyArray<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  tone: 'blue' | 'green' | 'purple' | 'orange';
}> = [
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Create and steer sessions',
    detail: 'Start work, follow progress, and reply when Devin needs you.',
    tone: 'blue',
  },
  {
    icon: 'git-compare-outline',
    title: 'Cloud or your computer',
    detail: 'Use Devin Cloud, pair a computer you control, or keep both together.',
    tone: 'green',
  },
  {
    icon: 'mic-outline',
    title: 'Speak detailed prompts',
    detail: 'Dictate on device, edit the transcript, and organize it before sending.',
    tone: 'purple',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Inspect Security Work',
    detail: 'Open genuine Code Scan sessions and review their coordinated agent work.',
    tone: 'orange',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Keep credentials private',
    detail: 'Cloud keys stay in iOS Keychain; computer credentials stay on your computer.',
    tone: 'blue',
  },
];

const TONE_CLASS: Record<(typeof FEATURES)[number]['tone'], string> = {
  blue: 'bg-tint-blue',
  green: 'bg-tint-green',
  purple: 'bg-tint-purple',
  orange: 'bg-tint-orange',
};

const TONE_COLOR: Record<(typeof FEATURES)[number]['tone'], 'brandText' | 'finished' | 'merged' | 'blocked'> = {
  blue: 'brandText',
  green: 'finished',
  purple: 'merged',
  orange: 'blocked',
};

export default function OnboardingFeaturesScreen() {
  const router = useRouter();
  const { tokens } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-6 pt-3 pb-5 flex-grow"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingBackButton onPress={() => router.back()} />

        <View className="mt-7 mb-7">
          <Text className="text-text-hi-strong text-text28 font-semibold text-center">
            Everything important, within reach
          </Text>
          <Text className="text-text-mid text-text14 leading-5 text-center mt-3 px-3">
            A focused mobile companion for the supported Devin work you already use.
          </Text>
        </View>

        <View className="gap-5 flex-1">
          {FEATURES.map((feature) => (
            <View key={feature.title} className="flex-row items-start">
              <View
                className={`w-12 h-12 rounded-button items-center justify-center mr-4 ${TONE_CLASS[feature.tone]}`}
              >
                <Ionicons
                  name={feature.icon}
                  size={22}
                  color={tokens[TONE_COLOR[feature.tone]].hex}
                />
              </View>
              <View className="flex-1 pt-0.5">
                <Text className="text-text-hi text-text16 font-semibold">{feature.title}</Text>
                <Text className="text-text-mid text-text13 leading-5 mt-1">{feature.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-8">
          <OnboardingProgress current={2} total={3} />
          <Pressable
            className="min-h-14 bg-brand rounded-button items-center justify-center mt-5"
            onPress={() => router.push('/(onboarding)/connections')}
            accessibilityRole="button"
            accessibilityLabel="Continue to connection choice"
          >
            <Text className="text-text-always-white text-text16 font-semibold">Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
