/**
 * Credentials screen — spec §7.1 step 2.
 * Segmented control: Service user key | Personal token (beta).
 * Service path: API key field (secure entry), org ID field, optional
 * attribution user ID. Inline help links to Devin docs.
 *
 * §10.6: credential fields use secureTextEntry to prevent screen recording
 * and shoulder-surfing.
 */
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@auth/AuthContext';
import { setPendingCredentials } from '@auth/pendingCredentials';
import { branding } from '@lib/branding';
import { useTheme } from '@theme/index';

type AuthMode = 'service_user' | 'pat';

export default function CredentialsScreen() {
  const router = useRouter();
  const { isPatAvailable } = useAuth();
  const { tokens } = useTheme();

  const [mode, setMode] = useState<AuthMode>('service_user');
  const [apiKey, setApiKey] = useState('');
  const [orgId, setOrgId] = useState('');
  const [attributionUserId, setAttributionUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = apiKey.trim().length > 0 && orgId.trim().length > 0;

  function handleSubmit() {
    setError(null);
    if (mode === 'service_user' && !apiKey.startsWith(branding.serviceKeyPrefix)) {
      setError(`API key must start with ${branding.serviceKeyPrefix}`);
      return;
    }
    if (!orgId.startsWith(branding.orgIdPrefix)) {
      setError(`Org ID must start with ${branding.orgIdPrefix}`);
      return;
    }
    // Hand credentials to the validate step in memory — never via router
    // params (they serialize into the URL on web; spec §10.1).
    setPendingCredentials({
      kind: mode,
      apiKey,
      orgId,
      attributionUserId: attributionUserId || undefined,
    });
    router.push('/(onboarding)/validate');
  }

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
        <Text className="text-text-hi text-text17 mb-6">Connect to Devin</Text>

        {/* Segmented control */}
        <View className="flex-row bg-tint-secondary rounded-button p-1 mb-6">
          <Pressable
            className={`flex-1 rounded-button py-2 ${mode === 'service_user' ? 'bg-surface2' : ''}`}
            onPress={() => setMode('service_user')}
          >
            <Text className={`text-center text-text14 ${mode === 'service_user' ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
              Service user key
            </Text>
          </Pressable>
          {isPatAvailable ? (
            <Pressable
              className={`flex-1 rounded-button py-2 ${mode === 'pat' ? 'bg-surface2' : ''}`}
              onPress={() => setMode('pat')}
            >
              <Text className={`text-center text-text14 ${mode === 'pat' ? 'text-text-hi font-medium' : 'text-text-mid'}`}>
                Personal token (beta)
              </Text>
            </Pressable>
          ) : (
            <View className="flex-1 py-2">
              <Text className="text-center text-text14 text-text-low">Personal token (soon)</Text>
            </View>
          )}
        </View>

        {/* API key field — §10.6 secureTextEntry */}
        <View className="mb-4">
          <Text className="text-text-mid text-text13 mb-2">
            {mode === 'service_user' ? 'Service user API key' : 'Personal access token'}
          </Text>
          <TextInput
            className="bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={mode === 'service_user' ? 'cog_...' : 'your PAT'}
            placeholderTextColor={tokens.textLow.hex}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {/* Org ID field */}
        <View className="mb-4">
          <Text className="text-text-mid text-text13 mb-2">Organization ID</Text>
          <TextInput
            className="bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
            value={orgId}
            onChangeText={setOrgId}
            placeholder="org-..."
            placeholderTextColor={tokens.textLow.hex}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>

        {/* Optional attribution user ID (service user mode only) */}
        {mode === 'service_user' && (
          <View className="mb-4">
            <Text className="text-text-mid text-text13 mb-2">
              Attribute sessions to (optional)
            </Text>
            <TextInput
              className="bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
              value={attributionUserId}
              onChangeText={setAttributionUserId}
              placeholder="Your user ID (for create_as_user_id)"
              placeholderTextColor={tokens.textLow.hex}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </View>
        )}

        {/* Inline help — link to Devin docs */}
        <Pressable
          className="mb-6"
          onPress={() => Linking.openURL(branding.links.createServiceUser)}
        >
          <Text className="text-link text-text13 underline">
            How to create a least-privilege service user →
          </Text>
        </Pressable>

        {error && (
          <View className="mb-4 bg-tint-red rounded-card px-4 py-3">
            <Text className="text-failed text-text13">{error}</Text>
          </View>
        )}

        <Pressable
          className={`rounded-button px-buttonPrimaryX py-buttonPrimaryY ${canSubmit ? 'bg-brand' : 'bg-tint-secondary'}`}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          <Text className={`text-center text-text14 font-medium ${canSubmit ? 'text-text-always-white' : 'text-text-low'}`}>
            Validate & connect
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
