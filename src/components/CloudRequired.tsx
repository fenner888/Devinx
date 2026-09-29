import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

export function useConnectDevinCloud(): () => void {
  const router = useRouter();
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);

  return useCallback(() => {
    setConnectionMode('cloud');
    router.replace('/(onboarding)/credentials');
  }, [router, setConnectionMode]);
}

export function CloudTag() {
  return (
    <View className="bg-tint-secondary rounded-chip px-2 py-0.5 ml-2">
      <Text className="text-text-low text-text11">Cloud</Text>
    </View>
  );
}

export function CloudRequiredState({ message }: { message: string }) {
  const connect = useConnectDevinCloud();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-text-hi text-text17 text-center mb-2">Needs Devin Cloud</Text>
      <Text className="text-text-mid text-text13 text-center">{message}</Text>
      <Pressable
        className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY mt-5"
        onPress={connect}
        accessibilityRole="button"
        accessibilityLabel="Connect Devin Cloud"
      >
        <Text className="text-text-always-white text-text14 font-medium text-center">
          Connect Devin Cloud
        </Text>
      </Pressable>
    </View>
  );
}

export function CloudRequiredScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const router = useRouter();
  const { tokens } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text17">{title}</Text>
      </View>
      <CloudRequiredState message={message} />
    </SafeAreaView>
  );
}
