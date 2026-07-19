/**
 * Cloud credential setup — spec §7.1.
 * Secrets remain in memory until validation and are never passed in route params.
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { orgIdSchema } from '@api/devin/schemas';
import { setPendingCredentials } from '@auth/pendingCredentials';
import { OnboardingBackButton } from '@components/onboarding/OnboardingBackButton';
import { ServiceUserGuideSheet } from '@components/onboarding/ServiceUserGuideSheet';
import { branding } from '@lib/branding';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

export default function CredentialsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const connectionMode = useAppPreferences((state) => state.connectionMode);
  const isCombinedSetup = connectionMode === 'both';

  const [apiKey, setApiKey] = useState('');
  const [orgId, setOrgId] = useState('');
  const [attributionUserId, setAttributionUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showServiceUserGuide, setShowServiceUserGuide] = useState(false);

  const canSubmit = apiKey.trim().length > 0 && orgId.trim().length > 0;

  function handleSubmit() {
    setError(null);
    if (!apiKey.startsWith(branding.serviceKeyPrefix)) {
      setError(`API key must start with ${branding.serviceKeyPrefix}`);
      return;
    }
    const trimmedOrgId = orgId.trim();
    if (!orgIdSchema.safeParse(trimmedOrgId).success) {
      setError('Org ID must use the org-… or org_… format');
      return;
    }

    setPendingCredentials({
      kind: 'service_user',
      apiKey,
      orgId: trimmedOrgId,
      attributionUserId: attributionUserId || undefined,
    });
    router.push('/(onboarding)/validate');
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-6 pt-3 pb-6 flex-grow"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingBackButton onPress={() => router.back()} />

          <View className="w-14 h-14 rounded-card bg-tint-blue items-center justify-center mt-7">
            <Ionicons name="cloud-outline" size={27} color={tokens.brandText.hex} />
          </View>
          {isCombinedSetup && (
            <Text className="text-brand-text text-text12 font-semibold tracking-wider mt-5">
              STEP 1 OF 2
            </Text>
          )}
          <Text className="text-text-hi-strong text-text28 font-semibold mt-5">
            Connect Devin Cloud
          </Text>
          <Text className="text-text-mid text-text14 leading-5 mt-3 mb-7">
            {isCombinedSetup
              ? 'First connect your Devin Cloud account. Next, you’ll pair your computer. Your scoped credential stays in the iOS Keychain.'
              : 'Use a scoped credential for your Devin organization. DevinX stores it in the iOS Keychain and never places it in logs or ordinary app storage.'}
          </Text>

          <View className="mb-4">
            <Text className="text-text-mid text-text13 mb-2">Service user API key</Text>
            <TextInput
              className="min-h-13 bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="cog_..."
              placeholderTextColor={tokens.textLow.hex}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textContentType="password"
              accessibilityLabel="Devin API key"
              testID="api-key-input"
            />
          </View>

          <View className="mb-4">
            <Text className="text-text-mid text-text13 mb-2">Organization ID</Text>
            <TextInput
              className="min-h-13 bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
              value={orgId}
              onChangeText={setOrgId}
              placeholder="org-... or org_..."
              placeholderTextColor={tokens.textLow.hex}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="Organization ID"
              testID="org-id-input"
            />
          </View>

          <View className="mb-4">
            <Text className="text-text-mid text-text13 mb-2">Attribution user ID (optional)</Text>
            <TextInput
              className="min-h-13 bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
              value={attributionUserId}
              onChangeText={setAttributionUserId}
              placeholder="Attribute newly created sessions"
              placeholderTextColor={tokens.textLow.hex}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="Attribution user ID"
            />
          </View>

          <View className="flex-row items-start bg-tint-blue rounded-card px-4 py-3 mt-1">
            <Ionicons name="shield-checkmark-outline" size={17} color={tokens.brandText.hex} />
            <Text className="text-brand-text text-text12 leading-4 ml-2 flex-1">
              Create a least-privilege service user with session-use and read permissions only.
            </Text>
          </View>

          <Pressable
            className="self-start py-4"
            onPress={() => setShowServiceUserGuide(true)}
            accessibilityRole="button"
            accessibilityLabel="Open service user instructions"
          >
            <Text className="text-link text-text13 font-medium">
              Open service user instructions
            </Text>
          </Pressable>

          {error && (
            <View className="mb-4 bg-tint-red rounded-card px-4 py-3" accessibilityRole="alert">
              <Text className="text-failed text-text13">{error}</Text>
            </View>
          )}

          <View className="flex-1 min-h-4" />
          <Pressable
            className={`min-h-14 rounded-button items-center justify-center ${canSubmit ? 'bg-brand' : 'bg-tint-secondary'}`}
            disabled={!canSubmit}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Validate and connect Devin Cloud"
            accessibilityState={{ disabled: !canSubmit }}
          >
            <Text
              className={`text-text16 font-semibold ${canSubmit ? 'text-text-always-white' : 'text-text-low'}`}
            >
              {isCombinedSetup ? 'Connect Cloud & continue' : 'Validate & connect'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <ServiceUserGuideSheet
        visible={showServiceUserGuide}
        onClose={() => setShowServiceUserGuide(false)}
      />
    </SafeAreaView>
  );
}
