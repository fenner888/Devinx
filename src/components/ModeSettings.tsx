/** ModeSettings — pure UI for documented Cloud session modes. */
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'normal' | 'fast';

const MODES: { key: Mode; label: string; description: string }[] = [
  { key: 'normal', label: 'Normal', description: 'Default agent mode' },
  { key: 'fast', label: 'Fast', description: 'About 2× faster and 4× more expensive' },
];

export function ModeSettings({
  mode,
  onChange,
  checkColor,
  mutedColor,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  /** Hex for the selected checkmark (theme brand text). */
  checkColor: string;
  /** Hex for muted icons. */
  mutedColor: string;
}) {
  return (
    <View>
      <Text className="text-text-low text-text12 py-1.5">Cloud mode</Text>
      {MODES.map(({ key, label, description }) => {
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
          Fast availability follows your Devin organization settings.
        </Text>
      </View>
    </View>
  );
}
