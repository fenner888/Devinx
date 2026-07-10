import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

const STEPS = [
  'Run the DevinX Desktop Bridge on your Mac.',
  'Choose Pair a phone to display a short-lived QR code.',
  'Scan the code here, then approve this phone on your Mac.',
];

export default function ComputerConnectionScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const mode = useAppPreferences((state) => state.connectionMode);
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);

  function useCloudInstead() {
    setConnectionMode('cloud');
    router.replace('/(onboarding)/credentials');
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

        <View className="w-14 h-14 rounded-card bg-tint-blue items-center justify-center mb-5">
          <Ionicons name="desktop-outline" size={27} color={tokens.brandText.hex} />
        </View>
        <Text className="text-text-hi text-text24 font-semibold mb-2">Connect your Mac</Text>
        <Text className="text-text-mid text-text14 leading-5 mb-7">
          Pair directly with a bridge you control. Your Devin CLI credentials stay on your Mac.
        </Text>

        <View className="bg-surface1 border border-border-subtle rounded-card px-4 py-2 mb-5">
          {STEPS.map((step, index) => (
            <View
              key={step}
              className={`flex-row items-start py-3 ${index < STEPS.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <View className="w-6 h-6 rounded-full bg-tint-blue items-center justify-center mr-3 mt-0.5">
                <Text className="text-brand-text text-text12 font-medium">{index + 1}</Text>
              </View>
              <Text className="text-text-mid text-text14 leading-5 flex-1">{step}</Text>
            </View>
          ))}
        </View>

        <View className="bg-tint-secondary rounded-card px-4 py-3 mb-5">
          <Text className="text-text-hi text-text13 font-medium mb-1">Pairing transport pending</Text>
          <Text className="text-text-low text-text12 leading-4">
            The signed pairing core is ready, but QR scanning remains disabled until the encrypted
            localhost transport passes its security gate.
          </Text>
        </View>

        {mode === 'computer' && (
          <Pressable
            className="border border-border rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={useCloudInstead}
            accessibilityRole="button"
            accessibilityLabel="Connect Devin Cloud instead"
          >
            <Text className="text-text-hi text-text14 font-medium text-center">
              Connect Devin Cloud instead
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
