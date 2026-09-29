/**
 * NavMenu — slide-over navigation panel (top-left menu), the pattern used by
 * Cursor / Perplexity / ChatGPT / Claude on mobile. Replaces a bottom tab bar.
 * Pure navigation UI. Authorization remains enforced at each destination.
 */
import { View, Text, Pressable, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@theme/index';
import { hapticLight } from '@lib/haptics';
import WORDMARK_DARK from '../../assets/wordmark.png';
import WORDMARK_LIGHT from '../../assets/wordmark-light.png';

interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: Href;
}

export function NavMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { name, tokens } = useTheme();
  // SafeAreaView doesn't inset correctly inside a Modal — read the device
  // insets from context and apply them manually so the header clears the
  // status bar and the footer clears the home indicator.
  const insets = useSafeAreaInsets();

  const primary: NavItem[] = [
    { icon: 'add', label: 'New session', route: '/(main)/compose' },
    { icon: 'chatbubbles-outline', label: 'Sessions', route: '/(main)/sessions' },
    { icon: 'time-outline', label: 'Automations', route: '/(main)/automations' },
    { icon: 'shield-checkmark-outline', label: 'Security Work', route: '/(main)/security-work' },
    { icon: 'git-pull-request-outline', label: 'Review', route: '/(main)/review' },
  ];

  function go(route: Href) {
    hapticLight();
    onClose();
    router.push(route);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-scrim">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close menu" />
        <View className="absolute top-0 bottom-0 left-0 w-[80%] max-w-[320px] bg-surface0 border-r border-border">
          <View
            className="flex-1"
            style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }}
          >
            <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
              <Image
                source={name === 'light' ? WORDMARK_LIGHT : WORDMARK_DARK}
                className="w-28 h-7"
                resizeMode="contain"
                accessibilityLabel="DevinX"
              />
              <Pressable
                className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center"
                onPress={onClose}
                accessibilityLabel="Close menu"
              >
                <Ionicons name="close" size={17} color={tokens.textMid.hex} />
              </Pressable>
            </View>

            <View className="px-3">
              {primary.map(({ icon, label, route }) => (
                <Pressable
                  key={label}
                  className="flex-row items-center rounded-card px-3 py-3"
                  onPress={() => go(route)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Ionicons name={icon} size={19} color={tokens.textMid.hex} />
                  <Text className="text-text-hi text-text16 ml-3">{label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Settings pinned at the bottom */}
            <View className="mt-auto px-3 pb-2 border-t border-border-subtle pt-2">
              <Pressable
                className="flex-row items-center rounded-card px-3 py-3"
                onPress={() => go('/(main)/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={18} color={tokens.textMid.hex} />
                <Text className="text-text-hi text-text16 ml-3 flex-1">Settings</Text>
                <Ionicons name="chevron-forward" size={15} color={tokens.textLow.hex} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
