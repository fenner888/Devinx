import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

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
    <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="px-6 py-8 flex-grow">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mb-6"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>

        <Text className="text-text-hi text-text24 font-semibold mb-2">How do you use Devin?</Text>
        <Text className="text-text-mid text-text14 leading-5 mb-7">
          Choose one now. You can add the other connection later without replacing your sessions.
        </Text>

        <View className="gap-3">
          {connectionModeOptions.map(({ key, label, description }) => (
            <Pressable
              key={key}
              className="flex-row items-center bg-surface1 border border-border-subtle rounded-card px-4 py-4"
              onPress={() => selectMode(key)}
              accessibilityRole="button"
              accessibilityLabel={`${label}. ${description}`}
            >
              <View className="w-11 h-11 rounded-button bg-tint-blue items-center justify-center mr-4">
                <Ionicons name={ICONS[key]} size={21} color={tokens.brandText.hex} />
              </View>
              <View className="flex-1">
                <Text className="text-text-hi text-text15 font-medium">{label}</Text>
                <Text className="text-text-low text-text13 leading-5 mt-1">{description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={tokens.textLow.hex} />
            </Pressable>
          ))}
        </View>

        <Text className="text-text-low text-text12 leading-4 mt-6">
          Computer connections use a user-controlled bridge. Devin credentials remain on the
          computer and are never copied to your phone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
