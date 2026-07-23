import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { OnboardingBackButton } from '@components/onboarding/OnboardingBackButton';
import { OnboardingProgress } from '@components/onboarding/OnboardingProgress';
import { connectionModeOptions, type ConnectionMode } from '@lib/connections';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

const ICONS: Record<ConnectionMode, keyof typeof Ionicons.glyphMap> = {
  cloud: 'cloud-outline',
  computer: 'desktop-outline',
  both: 'git-compare-outline',
};

export default function ConnectionChoiceScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);

  function selectMode(mode: ConnectionMode) {
    setConnectionMode(mode);
    router.push(
      mode === 'computer' ? '/(onboarding)/computer' : '/(onboarding)/credentials',
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-6 pt-3 pb-5 flex-grow"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingBackButton onPress={() => router.back()} />

        <View className="mt-7 mb-7">
          <Text className="text-text-hi-strong text-text28 font-semibold">Choose where Devin runs</Text>
          <Text className="text-text-mid text-text14 leading-5 mt-3">
            Start with one path. You can add the other later without replacing your sessions.
          </Text>
        </View>

        <View className="gap-3">
          {connectionModeOptions.map(({ key, label, description }) => (
            <Pressable
              key={key}
              className="min-h-24 flex-row items-center bg-surface1 border border-border rounded-card px-4 py-4"
              onPress={() => selectMode(key)}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${description}`}
            >
              <View className="w-11 h-11 rounded-button bg-tint-blue items-center justify-center mr-4">
                <Ionicons name={ICONS[key]} size={21} color={tokens.brandText.hex} />
              </View>
              <View className="flex-1">
                <Text className="text-text-hi text-text16 font-semibold">{label}</Text>
                <Text className="text-text-low text-text13 leading-5 mt-1">{description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={tokens.textLow.hex} />
            </Pressable>
          ))}
        </View>

        <View className="flex-1" />

        <View className="mt-8">
          <View className="flex-row items-start bg-tint-blue rounded-card px-4 py-3 mb-5">
            <Ionicons name="shield-checkmark-outline" size={17} color={tokens.brandText.hex} />
            <Text className="text-brand-text text-text12 leading-4 ml-2 flex-1">
              Tailscale provides the private network route. DevinX Connector provides authorized
              access to local sessions. Your Devin credentials remain on the local device.
            </Text>
          </View>
          <OnboardingProgress current={3} total={3} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
