import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';

const rows = [
  {
    title: 'On-device storage',
    detail:
      'Paired-device keys stay in the system Keychain. Compose drafts, session context, and the read cache stay on this device and are removed when you wipe local data. Your appearance choice may remain.',
  },
  {
    title: 'Voice dictation and Scribe',
    detail:
      'Voice is transcribed on your device. Audio never leaves your phone and is not saved. Scribe uses Apple Intelligence on-device when available, with a deterministic on-device template fallback.',
  },
  {
    title: 'Crash reports',
    detail:
      'This release does not bundle or configure a crash-reporting SDK, so crash reports are not transmitted. If reporting is enabled in a future release, this disclosure and the App Store privacy answers must be updated first.',
  },
  {
    title: 'Product analytics',
    detail:
      'No product analytics SDK is enabled. Session titles, prompts, messages, repository names, and attachment contents are never sent to analytics.',
  },
  {
    title: 'Local sessions',
    detail:
      'After you pair and approve an iPhone, Otterin can request minimized Devin session data directly from your Mac over Tailscale. Metadata is the default; message text requires a separate read grant. Local files, tool payloads, thoughts, and credentials are not returned.',
  },
  {
    title: 'Tailscale and private networks',
    detail:
      'If you choose Tailscale, it supplies private network reachability between your devices. Otterin still authenticates every bridge request, and no Otterin-operated relay receives the session.',
  },
  {
    title: 'App delivery',
    detail:
      'The installed app may contact Expo over TLS to check for compatible Otterin updates. Expo may receive the device operating system, project ID, normal network metadata, and a randomized installation token. This release does not register your iPhone for remote push notifications.',
  },
  {
    title: 'Your controls and deletion',
    detail:
      'Wiping local data removes paired-Mac keys, drafts, saved session context, and cached data from this iPhone. Revoking the iPhone in DevinX Connector ends its local-device access.',
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
          Otterin does not relay session content through its own backend. Approved local-session
          requests go directly to your paired Mac.
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
          onPress={() =>
            Linking.openURL('https://github.com/fenner888/Devinx/blob/main/PRIVACY.md')
          }
          accessibilityRole="link"
          accessibilityLabel="Open the full Otterin privacy policy"
        >
          <Text className="text-brand-text text-text14 font-medium">Full privacy policy</Text>
          <Ionicons name="open-outline" size={14} color={tokens.brandText.hex} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
