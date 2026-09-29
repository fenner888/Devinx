/**
 * Validate screen — spec §7.1 step 3.
 * Live check: authenticated GET sessions call. Success → store in Keychain →
 * land on Board. Failure → specific error (401/403/network).
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@auth/AuthContext';
import { takePendingCredentials } from '@auth/pendingCredentials';
import type { ValidationResult } from '@auth/AuthProvider';
import { useTheme } from '@theme/index';
import { useAppPreferences } from '@store/preferences';

export default function ValidateScreen() {
  const router = useRouter();
  const { connect } = useAuth();
  const { tokens } = useTheme();
  const connectionMode = useAppPreferences((state) => state.connectionMode);

  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    const creds = takePendingCredentials();
    if (!creds) {
      // Nothing pending (e.g. web reload) — go back to credentials.
      router.replace('/(onboarding)/credentials');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const r = await connect(creds);
      if (cancelled) return;
      setResult(r);
      setStatus(r.ok ? 'success' : 'error');
      if (r.ok) {
        // Combined mode continues to computer pairing; Cloud-only lands in main.
        timer = setTimeout(
          () =>
            router.replace(
              connectionMode === 'both' ? '/(onboarding)/computer' : '/(main)',
            ),
          600,
        );
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [connect, connectionMode, router]);

  return (
    <SafeAreaView
      className="flex-1 bg-surface0 items-center justify-center px-screen"
      edges={['top', 'bottom']}
    >
      {status === 'validating' && (
        <View className="items-center w-full max-w-sm">
          <View className="w-24 h-24 rounded-[28px] bg-tint-blue border border-border items-center justify-center mb-8">
            <ActivityIndicator size="large" color={tokens.brand.hex} />
          </View>
          <Text className="text-brand text-text11 font-semibold tracking-[2px] mb-3">
            SECURE CONNECTION
          </Text>
          <Text className="text-text-high text-text28 font-semibold text-center mb-3">
            Connecting to Devin
          </Text>
          <Text className="text-text-mid text-text15 text-center leading-6">
            Verifying the credential and organization without exposing the key to logs or ordinary app storage.
          </Text>
        </View>
      )}

      {status === 'success' && (
        <View className="items-center w-full max-w-sm">
          <View className="w-24 h-24 rounded-[28px] bg-tint-green border border-border items-center justify-center mb-8">
            <Ionicons name="checkmark" size={48} color={tokens.finished.hex} />
          </View>
          <Text className="text-finished text-text11 font-semibold tracking-[2px] mb-3">
            CONNECTED
          </Text>
          <Text className="text-text-high text-text28 font-semibold text-center mb-3">
            Devin Cloud is ready
          </Text>
          <Text className="text-text-mid text-text15 text-center">
            Loading your sessions…
          </Text>
        </View>
      )}

      {status === 'error' && result && !result.ok && (
        <View className="items-center w-full max-w-sm">
          <View className="w-24 h-24 rounded-[28px] bg-tint-red border border-border items-center justify-center mb-8">
            <Ionicons name="alert" size={42} color={tokens.failed.hex} />
          </View>
          <Text className="text-failed text-text11 font-semibold tracking-[2px] mb-3">
            CONNECTION FAILED
          </Text>
          <Text className="text-text-high text-text28 font-semibold text-center mb-3">
            Check your details
          </Text>
          <View className="bg-tint-red rounded-card px-5 py-4 mb-7 w-full">
            <Text className="text-failed text-text14 text-center leading-5">{result.detail}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Devin Cloud credentials"
            className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY w-full min-h-14 items-center justify-center"
            onPress={() => router.replace('/(onboarding)/credentials')}
          >
            <Text className="text-text-always-white text-text16 font-semibold">Try again</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
