/**
 * Settings screen — grouped card sections with icon tiles, matching the
 * Devin settings design (specs/reference-ui/04-settings.png).
 * Connection status, theme, behavior, account, resources, and secure disconnect.
 */
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, TextInput } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@auth/AuthContext';
import { useConnections } from '@auth/ConnectionContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCodeScanFindings, useSelf } from '@api/devin/queries';
import { purgeCache } from '@cache/index';
import { branding } from '@lib/branding';
import { connectionModeOptions } from '@lib/connections';
import { confirmAction } from '@lib/confirm';
import { normalizeDefaultTags, useAppPreferences, type PollingMode } from '@store/preferences';
import {
  setThemePreference,
  useThemePreference,
  useTheme,
  type ThemePreference,
} from '@theme/index';

export default function SettingsScreen() {
  const router = useRouter();
  const { provider } = useAuth();
  const {
    mode: connectionMode,
    hasCloudConnection,
    hasComputerConnection,
    computers,
    connectionError,
    disconnectAll,
  } = useConnections();
  const queryClient = useQueryClient();
  const { data: scanFindings } = useCodeScanFindings();
  const { data: self } = useSelf();
  const { tokens } = useTheme();
  const currentPref = useThemePreference();
  const pollingMode = useAppPreferences((s) => s.pollingMode);
  const setPollingMode = useAppPreferences((s) => s.setPollingMode);
  const hapticsEnabled = useAppPreferences((s) => s.hapticsEnabled);
  const setHaptics = useAppPreferences((s) => s.setHaptics);
  const defaultTags = useAppPreferences((s) => s.defaultTags);
  const setDefaultTags = useAppPreferences((s) => s.setDefaultTags);
  const [defaultTagsInput, setDefaultTagsInput] = useState(defaultTags.join(', '));
  const [credentialFingerprint, setCredentialFingerprint] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    provider
      ?.credentialFingerprint()
      .then((fingerprint) => {
        if (active) setCredentialFingerprint(fingerprint);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [provider]);

  function saveDefaultTags() {
    const tags = normalizeDefaultTags(defaultTagsInput);
    setDefaultTags(tags);
    setDefaultTagsInput(tags.join(', '));
  }

  function handleDisconnect() {
    confirmAction(
      {
        title: 'Disconnect?',
        message:
          'This wipes Devin Cloud credentials, paired-computer keys, and all cached session data from this device. Your Devin sessions are not affected.',
        confirmLabel: 'Disconnect',
        destructive: true,
      },
      async () => {
        setDisconnectError(null);
        try {
          await disconnectAll();
          await purgeCache();
          queryClient.clear();
          router.replace('/(onboarding)');
        } catch {
          setDisconnectError(
            'The secure wipe did not complete. Your connections remain locked; please try again.',
          );
        }
      },
    );
  }

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'dark', label: 'Dark' },
    { key: 'light', label: 'Light' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text20">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        {/* Connections */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Connections</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
            <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
              <Ionicons name="git-compare-outline" size={15} color={tokens.brandText.hex} />
            </View>
            <View className="flex-1">
              <Text className="text-text-hi text-text14">Connection mode</Text>
              <Text className="text-text-low text-text12 mt-0.5">
                {connectionModeOptions.find((option) => option.key === connectionMode)?.label}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
            <Ionicons
              name="cloud-outline"
              size={17}
              color={hasCloudConnection ? tokens.finished.hex : tokens.textLow.hex}
            />
            <Text className="text-text-hi text-text14 flex-1 ml-3">Devin Cloud</Text>
            <Text className="text-text-low text-text12">
              {hasCloudConnection ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          <View className="flex-row items-center px-4 py-3">
            <Ionicons
              name="desktop-outline"
              size={17}
              color={hasComputerConnection ? tokens.finished.hex : tokens.textLow.hex}
            />
            <View className="flex-1 ml-3">
              <Text className="text-text-hi text-text14">
                {computers.length === 1 ? computers[0]?.computerName : 'Computers'}
              </Text>
              <Text className="text-text-low text-text12 mt-0.5">
                {hasComputerConnection
                  ? `${computers.length} paired ${computers.length === 1 ? 'computer' : 'computers'}`
                  : 'No paired computers'}
              </Text>
            </View>
          </View>
          {connectionError && (
            <View className="bg-tint-red px-4 py-3 border-t border-border-subtle">
              <Text className="text-failed text-text12">{connectionError}</Text>
            </View>
          )}
        </View>

        {/* Appearance */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Appearance</Text>
        <View className="flex-row bg-tint-secondary rounded-button p-1 mb-6">
          {themeOptions.map(({ key, label }) => (
            <Pressable
              key={key}
              className={`flex-1 rounded-button py-2 ${currentPref === key ? 'bg-surface2' : ''}`}
              onPress={() => setThemePreference(key)}
            >
              <Text
                className={`text-center text-text14 ${currentPref === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Behavior */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Behavior</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          <View className="px-4 py-3 border-b border-border-subtle">
            <Text className="text-text-hi text-text14 mb-2">Polling</Text>
            <View className="flex-row bg-tint-secondary rounded-button p-1">
              {(
                [
                  { key: 'battery_saver', label: 'Battery saver' },
                  { key: 'balanced', label: 'Balanced' },
                  { key: 'fast', label: 'Fast' },
                ] as { key: PollingMode; label: string }[]
              ).map(({ key, label }) => (
                <Pressable
                  key={key}
                  className={`flex-1 rounded-button py-2 ${pollingMode === key ? 'bg-surface2' : ''}`}
                  onPress={() => setPollingMode(key)}
                >
                  <Text
                    className={`text-center text-text13 ${pollingMode === key ? 'text-text-hi font-medium' : 'text-text-mid'}`}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-text-low text-text12 mt-2">
              How often the app refreshes sessions while open.
            </Text>
          </View>
          <View className="px-4 py-3 border-b border-border-subtle">
            <Text className="text-text-hi text-text14 mb-1">Default session tags</Text>
            <Text className="text-text-low text-text12 mb-2">
              Comma-separated tags applied to new sessions.
            </Text>
            <View className="flex-row items-center bg-surface2 rounded-input px-3 py-2">
              <TextInput
                className="flex-1 text-text-hi text-text13"
                value={defaultTagsInput}
                onChangeText={setDefaultTagsInput}
                onBlur={saveDefaultTags}
                onSubmitEditing={saveDefaultTags}
                placeholder="mobile, priority"
                placeholderTextColor={tokens.textLow.hex}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Default session tags"
              />
              <Pressable
                onPress={saveDefaultTags}
                accessibilityRole="button"
                accessibilityLabel="Save default tags"
              >
                <Text className="text-brand-text text-text13 font-medium">Save</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            className="flex-row items-center px-4 py-3"
            onPress={() => setHaptics(!hapticsEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: hapticsEnabled }}
            accessibilityLabel="Haptic feedback"
          >
            <View className="flex-1">
              <Text className="text-text-hi text-text14">Haptic feedback</Text>
              <Text className="text-text-low text-text12 mt-0.5">
                Vibrate on taps and status changes.
              </Text>
            </View>
            <View
              className={`w-12 h-7 rounded-chip p-0.5 ${hapticsEnabled ? 'bg-brand' : 'bg-tint-primary'}`}
            >
              <View
                className={`w-6 h-6 rounded-chip bg-surface2 ${hapticsEnabled ? 'ml-auto' : ''}`}
              />
            </View>
          </Pressable>
        </View>

        {/* Account */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Account</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle overflow-hidden mb-6">
          <View className="flex-row items-center px-4 py-3 border-b border-border-subtle">
            <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
              <Ionicons name="key-outline" size={15} color={tokens.brandText.hex} />
            </View>
            <View className="flex-1">
              <Text className="text-text-hi text-text14">
                {self?.service_user_name ||
                  self?.service_user_id ||
                  self?.user_id ||
                (provider
                  ? provider.kind === 'pat'
                    ? 'Personal access token'
                    : 'Service user key'
                  : 'Devin Cloud not connected')}
              </Text>
              <Text className="text-text-low text-text12 mt-0.5">
                {self?.org_id ? `${self.org_id} · ` : ''}
                {provider
                  ? provider.kind === 'pat'
                    ? 'Personal access token'
                    : 'Service user key'
                  : 'Computer-only mode'}
                {provider && credentialFingerprint ? ` · ending ${credentialFingerprint}` : ''}
              </Text>
            </View>
          </View>
          {provider && <Pressable
            className="flex-row items-center px-4 py-3"
            onPress={() => router.push('/(main)/usage')}
            accessibilityRole="button"
            accessibilityLabel="View ACU consumption"
          >
            <View className="w-8 h-8 rounded-button bg-tint-green items-center justify-center mr-3">
              <Ionicons name="speedometer-outline" size={15} color={tokens.finished.hex} />
            </View>
            <Text className="text-text-hi text-text14 flex-1">Usage & limits</Text>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>}
        </View>

        {/* Products */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Products</Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-6">
          {(
            [
              {
                icon: 'git-pull-request-outline',
                label: 'Review',
                route: '/(main)/review',
                tint: 'bg-tint-blue',
                color: tokens.brandText.hex,
              },
              ...(scanFindings
                ? [
                    {
                      icon: 'shield-outline',
                      label: 'Security',
                      route: '/(main)/security',
                      tint: 'bg-tint-red',
                      color: tokens.failed.hex,
                    } as const,
                  ]
                : []),
            ] as const
          ).map(({ icon, label, route, tint, color }, i, arr) => (
            <Pressable
              key={label}
              className={`flex-row items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border-subtle' : ''}`}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View className={`w-8 h-8 rounded-button items-center justify-center mr-3 ${tint}`}>
                <Ionicons name={icon} size={15} color={color} />
              </View>
              <Text className="text-text-hi text-text14 flex-1">{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
            </Pressable>
          ))}
        </View>

        {/* Resources — mirrors the web settings tree */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Resources</Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-6">
          {(
            [
              {
                icon: 'document-text-outline',
                label: 'Knowledge',
                route: '/(main)/knowledge',
                tint: 'bg-tint-purple',
                color: tokens.merged.hex,
              },
              {
                icon: 'book-outline',
                label: 'Playbooks',
                route: '/(main)/playbooks',
                tint: 'bg-tint-blue',
                color: tokens.brandText.hex,
              },
              {
                icon: 'lock-closed-outline',
                label: 'Secrets',
                route: '/(main)/secrets',
                tint: 'bg-tint-orange',
                color: tokens.blocked.hex,
              },
              {
                icon: 'stats-chart-outline',
                label: 'Analytics',
                route: '/(main)/analytics',
                tint: 'bg-tint-green',
                color: tokens.finished.hex,
              },
            ] as const
          ).map(({ icon, label, route, tint, color }, i, arr) => (
            <Pressable
              key={label}
              className={`flex-row items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border-subtle' : ''}`}
              onPress={() => router.push(route)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View className={`w-8 h-8 rounded-button items-center justify-center mr-3 ${tint}`}>
                <Ionicons name={icon} size={15} color={color} />
              </View>
              <Text className="text-text-hi text-text14 flex-1">{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
            </Pressable>
          ))}
        </View>

        <Text className="text-text-low text-text12 font-medium uppercase mb-2">Privacy</Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-6">
          <Pressable
            className="flex-row items-center px-4 py-3"
            onPress={() => router.push('/(main)/privacy')}
            accessibilityRole="button"
            accessibilityLabel="What data leaves your device"
          >
            <View className="w-8 h-8 rounded-button bg-tint-blue items-center justify-center mr-3">
              <Ionicons name="shield-checkmark-outline" size={15} color={tokens.brandText.hex} />
            </View>
            <View className="flex-1">
              <Text className="text-text-hi text-text14">What data leaves your device?</Text>
              <Text className="text-text-low text-text12 mt-0.5">
                Direct API, storage, crash reports, and analytics.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={tokens.textLow.hex} />
          </Pressable>
        </View>

        {/* About */}
        <Text className="text-text-low text-text12 font-medium uppercase mb-2">About</Text>
        <View className="bg-surface1 rounded-2xl border border-border-subtle px-4 py-3 mb-6">
          <Text className="text-text-hi text-text14 mb-1">{branding.name}</Text>
          <Text className="text-text-mid text-text13 mb-1">{branding.subtitle}</Text>
          <Text className="text-text-low text-text12 mb-3">
            Version {Constants.expoConfig?.version ?? '0.1.0'}
          </Text>
          <Text className="text-text-low text-text12 leading-4 mb-3">{branding.disclaimer}</Text>
          <View className="flex-row flex-wrap">
            <Pressable className="mr-4 mb-2" onPress={() => Linking.openURL(branding.links.docs)}>
              <Text className="text-link text-text13">Devin docs →</Text>
            </Pressable>
            <Pressable className="mr-4 mb-2" onPress={() => Linking.openURL(branding.links.status)}>
              <Text className="text-link text-text13">Devin status →</Text>
            </Pressable>
            <Pressable
              className="mb-2"
              onPress={() => Linking.openURL('https://github.com/fenner888/Devinx')}
              accessibilityRole="link"
              accessibilityLabel="Open-source licenses"
            >
              <Text className="text-link text-text13">Licenses →</Text>
            </Pressable>
          </View>
        </View>

        {/* Disconnect */}
        {disconnectError && (
          <View className="bg-tint-red rounded-card px-4 py-3 mb-3">
            <Text className="text-failed text-text12">{disconnectError}</Text>
          </View>
        )}
        <Pressable
          className="flex-row items-center justify-center bg-destructive rounded-button px-buttonPrimaryX py-buttonPrimaryY mb-8"
          onPress={handleDisconnect}
          accessibilityRole="button"
          accessibilityLabel="Disconnect and wipe data"
        >
          <Ionicons name="log-out-outline" size={16} color={tokens.textAlwaysWhite.hex} />
          <Text className="text-text-always-white text-text14 font-medium ml-2">
            Disconnect & wipe all connections
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
