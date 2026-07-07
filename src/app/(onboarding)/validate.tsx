/**
 * Validate screen — spec §7.1 step 3.
 * Live check: authenticated GET sessions call. Success → store in Keychain →
 * land on Board. Failure → specific error (401/403/network).
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@auth/AuthContext';
import { takePendingCredentials } from '@auth/pendingCredentials';
import type { ValidationResult } from '@auth/AuthProvider';
import { useTheme } from '@theme/index';

export default function ValidateScreen() {
  const router = useRouter();
  const { connect } = useAuth();
  const { tokens } = useTheme();

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
        // Route guard will redirect to (main) automatically.
        // Small delay so the user sees the success state.
        timer = setTimeout(() => router.replace('/(main)'), 600);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface0 items-center justify-center px-6" edges={['top', 'bottom']}>
      {status === 'validating' && (
        <View className="items-center">
          <ActivityIndicator size="large" color={tokens.brand.hex} />
          <Text className="text-text-mid text-text14 mt-4">Validating your credentials…</Text>
        </View>
      )}

      {status === 'success' && (
        <View className="items-center">
          <Text className="text-finished text-text17 mb-2">✓ Connected</Text>
          <Text className="text-text-mid text-text14">Loading your sessions…</Text>
        </View>
      )}

      {status === 'error' && result && !result.ok && (
        <View className="items-center w-full max-w-sm">
          <Text className="text-failed text-text17 mb-3">Connection failed</Text>
          <View className="bg-tint-red rounded-card px-4 py-3 mb-6 w-full">
            <Text className="text-failed text-text13 text-center">{result.detail}</Text>
          </View>
          <Pressable
            className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY"
            onPress={() => router.replace('/(onboarding)/credentials')}
          >
            <Text className="text-text-always-white text-text14 font-medium">Try again</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
