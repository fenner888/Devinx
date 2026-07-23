import { Ionicons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { branding } from '@lib/branding';
import { useTheme } from '@theme/index';

type ServiceUserGuideSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const steps = [
  {
    title: 'Open Service users',
    detail: 'In Devin, open Settings and choose Service users for your organization.',
  },
  {
    title: 'Create a scoped service user',
    detail:
      'Choose the least-privilege role that covers the actions you plan to use: read and list sessions, create sessions, and send messages.',
  },
  {
    title: 'Generate its API key',
    detail: 'Copy the cog_ key when Devin shows it. The key is displayed only once.',
  },
  {
    title: 'Copy your organization ID',
    detail: 'Find the organization ID on the same Service users page, then return here and paste both values.',
  },
] as const;

export function ServiceUserGuideSheet({ visible, onClose }: ServiceUserGuideSheetProps) {
  const { tokens } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-scrim">
        <Pressable
          className="absolute inset-0"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close service user instructions"
        />
        <SafeAreaView
          className="max-h-[90%] rounded-t-sheet bg-surface2"
          edges={['bottom']}
          accessibilityViewIsModal
        >
          <View className="px-5 pt-4">
            <View className="mb-4 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-text-hi text-text20 font-semibold">
                  Create your Devin service user
                </Text>
                <Text className="mt-1 text-text-mid text-text13 leading-5">
                  Your key stays in iOS Keychain and is sent only to Devin for authenticated API requests.
                </Text>
              </View>
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-tint-secondary"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close service user instructions"
              >
                <Ionicons name="close" size={20} color={tokens.textMid.hex} />
              </Pressable>
            </View>

            <ScrollView
              className="min-h-0"
              contentContainerClassName="pb-3"
              showsVerticalScrollIndicator={false}
            >
              {steps.map((step, index) => (
                <View key={step.title} className="mb-3 flex-row rounded-card bg-surface1 px-4 py-3">
                  <View className="mr-3 h-7 w-7 items-center justify-center rounded-full bg-tint-blue">
                    <Text className="text-brand-text text-text12 font-semibold">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text-hi text-text14 font-medium">{step.title}</Text>
                    <Text className="mt-1 text-text-mid text-text12 leading-4">{step.detail}</Text>
                  </View>
                </View>
              ))}

              <View className="mb-3 flex-row items-start rounded-card bg-tint-blue px-4 py-3">
                <Ionicons name="person-outline" size={18} color={tokens.brandText.hex} />
                <Text className="ml-2 flex-1 text-brand-text text-text12 leading-4">
                  Attribution is optional. Use it only when the service user has Devin’s ImpersonateOrgSessions permission.
                </Text>
              </View>
            </ScrollView>

            <Pressable
              className="mb-2 min-h-12 flex-row items-center justify-center rounded-button bg-brand"
              onPress={() => Linking.openURL(branding.links.devinApp)}
              accessibilityRole="link"
              accessibilityLabel="Open Devin"
            >
              <Text className="text-text-always-white text-text14 font-semibold">Open Devin</Text>
              <Ionicons
                className="ml-2"
                name="open-outline"
                size={17}
                color={tokens.textAlwaysWhite.hex}
              />
            </Pressable>
            <Pressable
              className="mb-4 min-h-12 flex-row items-center justify-center rounded-button bg-tint-secondary"
              onPress={() => Linking.openURL(branding.links.createServiceUser)}
              accessibilityRole="link"
              accessibilityLabel="Read official Devin authentication documentation"
            >
              <Text className="text-text-hi text-text14 font-medium">Read official Devin docs</Text>
              <Ionicons
                className="ml-2"
                name="open-outline"
                size={17}
                color={tokens.textMid.hex}
              />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
