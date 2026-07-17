/** ModeSettings — pure UI for documented Cloud session modes. */
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DevinMode } from '@api/devin/types';
import { MODE_OPTIONS } from '@lib/session-utils';

export function ModeSettings({
  mode,
  onChange,
  checkColor,
  mutedColor,
}: {
  mode: DevinMode;
  onChange: (mode: DevinMode) => void;
  /** Hex for the selected checkmark (theme brand text). */
  checkColor: string;
  /** Hex for muted icons. */
  mutedColor: string;
}) {
  return (
    <View>
      <Text className="text-text-low text-text12 py-1.5">Cloud mode</Text>
      {MODE_OPTIONS.map(({ key, label, description }) => {
        const selected = mode === key;
        return (
          <Pressable
            key={key}
            className="flex-row items-center py-2.5"
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${label} Cloud mode`}
            accessibilityState={{ selected }}
          >
            <View className="flex-1">
              <Text className="text-text-hi text-text14">{label}</Text>
              <Text className="text-text-low text-text12 mt-0.5">{description}</Text>
            </View>
            {selected && <Ionicons name="checkmark" size={16} color={checkColor} />}
          </Pressable>
        );
      })}

      <View className="flex-row items-start mt-2">
        <Ionicons name="information-circle-outline" size={12} color={mutedColor} />
        <Text className="text-text-low text-text11 ml-1.5 flex-1">
          Preview mode availability follows your Devin organization settings. Devin returns an
          error when a selected mode is unavailable to this account.
        </Text>
      </View>
    </View>
  );
}
