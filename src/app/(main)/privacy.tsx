import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';

const rows = [
  {
    title: 'Devin API requests',
    detail:
      'Credentials, prompts, attachments, and session actions go directly from this device to api.devin.ai over TLS.',
  },
  {
    title: 'On-device storage',
    detail:
      'Credentials stay in the system Keychain. Preferences and the read cache stay on this device and are wiped when you disconnect.',
  },
  {
    title: 'Crash reports',
    detail:
      'Sentry is disabled unless a production DSN is configured. Secret-like values and authorization data are scrubbed before any report leaves the device.',
  },
  {
    title: 'Product analytics',
    detail:
      'No product analytics SDK is enabled. Session titles, prompts, messages, repository names, and attachment contents are never sent to analytics.',
  },
  {
    title: 'Local Desktop sessions',
    detail:
      'Only after you pair and approve an iPhone, DevinX can request minimized Devin CLI session data directly from your Mac over pinned TLS. Metadata is the default; message text requires a separate read grant. Local files, tool payloads, thoughts, and credentials are not returned.',
  },
  {
    title: 'Tailscale and private networks',
    detail:
      'If you choose Tailscale, it supplies private network reachability between your devices. DevinX still authenticates every bridge request, and no DevinX-operated relay receives the session.',
  },
] as const;

export default function PrivacyScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top']}>
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mr-3"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>
        <Text className="text-text-hi text-text20">Privacy</Text>
      </View>
      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        <Text className="text-text-hi text-text20 font-medium mb-2">
          What data leaves your device?
        </Text>
        <Text className="text-text-mid text-text14 leading-5 mb-5">
          DevinX has no intermediary backend. Cloud actions go directly to Cognition's Devin API;
          approved local-session requests go directly to your paired Mac.
        </Text>
        <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden mb-5">
          {rows.map((row, index) => (
            <View
              key={row.title}
              className={`px-4 py-3 ${index < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <Text className="text-text-hi text-text14 font-medium mb-1">{row.title}</Text>
              <Text className="text-text-mid text-text13 leading-5">{row.detail}</Text>
            </View>
          ))}
        </View>
        <Pressable
          className="flex-row items-center justify-center rounded-button bg-tint-secondary py-3"
          onPress={() => Linking.openURL('https://docs.devin.ai/api-reference/v3/overview')}
          accessibilityRole="link"
          accessibilityLabel="Open Devin API privacy documentation"
        >
          <Text className="text-brand-text text-text14 font-medium">Devin API documentation</Text>
          <Ionicons name="open-outline" size={14} color={tokens.brandText.hex} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
