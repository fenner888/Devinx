import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { confirmAction } from '@lib/confirm';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

export default function LaunchProfilesScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const profiles = useAppPreferences((state) => state.launchProfiles);
  const activeId = useAppPreferences((state) => state.activeLaunchProfileId);
  const setActive = useAppPreferences((state) => state.setActiveLaunchProfile);
  const removeProfile = useAppPreferences((state) => state.removeLaunchProfile);

  function remove(id: string, name: string) {
    confirmAction(
      {
        title: `Delete ${name}?`,
        message: 'This removes only the device-local defaults. Devin resources are not changed.',
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => removeProfile(id),
    );
  }

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
        <View className="flex-1">
          <Text className="text-text-hi text-text20">Launch profiles</Text>
          <Text className="text-text-low text-text12 mt-0.5">Device-local Cloud defaults</Text>
        </View>
        <Pressable
          className="bg-brand rounded-button px-3 py-2"
          onPress={() => router.push('/(main)/compose')}
          accessibilityRole="button"
          accessibilityLabel="Create a launch profile in the new session composer"
        >
          <Text className="text-text-always-white text-text13 font-medium">Create</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        <View className="bg-tint-blue rounded-card px-4 py-3 mb-5 flex-row">
          <Ionicons name="shield-checkmark-outline" size={18} color={tokens.brandText.hex} />
          <Text className="text-brand-text text-text12 leading-4 flex-1 ml-2">
            Profiles save repository and resource IDs, mode, tags, and limits. They never save
            prompts, API keys, or secret values.
          </Text>
        </View>

        {profiles.length === 0 ? (
          <View className="items-center px-6 py-16">
            <Ionicons name="options-outline" size={34} color={tokens.textLow.hex} />
            <Text className="text-text-hi text-text17 mt-4">No profiles yet</Text>
            <Text className="text-text-low text-text13 text-center mt-2 leading-5">
              Open New Session, choose your Cloud settings, then select Save profile.
            </Text>
          </View>
        ) : (
          <View className="bg-surface1 rounded-card border border-border-subtle overflow-hidden">
            {profiles.map((profile, index) => {
              const active = profile.id === activeId;
              return (
                <View
                  key={profile.id}
                  className={`flex-row items-center px-4 py-4 ${index < profiles.length - 1 ? 'border-b border-border-subtle' : ''} ${active ? 'bg-tint-blue' : ''}`}
                >
                  <Pressable
                    className="flex-1 flex-row items-center"
                    onPress={() => setActive(active ? null : profile.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${profile.name} launch profile`}
                  >
                    <View
                      className={`w-9 h-9 rounded-button items-center justify-center mr-3 ${active ? 'bg-brand' : 'bg-tint-secondary'}`}
                    >
                      <Ionicons
                        name="rocket-outline"
                        size={17}
                        color={active ? tokens.textAlwaysWhite.hex : tokens.textMid.hex}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-text14 font-medium ${active ? 'text-brand-text' : 'text-text-hi'}`}
                      >
                        {profile.name}
                      </Text>
                      <Text className="text-text-low text-text12 mt-0.5" numberOfLines={2}>
                        {profile.repositoryPaths.length > 0
                          ? profile.repositoryPaths.join(', ')
                          : 'Any repository'}
                        {' · '}
                        {profile.mode}
                        {profile.tags.length > 0 ? ` · ${profile.tags.join(', ')}` : ''}
                      </Text>
                    </View>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color={tokens.brandText.hex} />
                    )}
                  </Pressable>
                  <Pressable
                    className="ml-3 p-2"
                    onPress={() => remove(profile.id, profile.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${profile.name}`}
                  >
                    <Ionicons name="trash-outline" size={17} color={tokens.failed.hex} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
