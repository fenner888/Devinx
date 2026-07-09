/**
 * ModeSettings — pure UI (props only). Mirrors the app.devin.ai composer
 * settings dropdown: Fusion (Preview) toggle, Capability (Normal/Ultra/Lite),
 * Speed (Standard/Fast).
 *
 * The public API takes a single `devin_mode` enum, so the groups are
 * mutually exclusive here: Fusion on → fusion; Speed Fast → fast;
 * otherwise the selected capability.
 */
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'normal' | 'fast' | 'lite' | 'ultra' | 'fusion';

const CAPABILITIES: { key: Mode; label: string; description: string }[] = [
  { key: 'normal', label: 'Normal', description: 'Default capability' },
  { key: 'ultra', label: 'Ultra', description: 'Most capable — for complex work' },
  { key: 'lite', label: 'Lite', description: 'Lightweight — cheapest for simple tasks' },
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
  const fusionOn = mode === 'fusion';
  const fastOn = mode === 'fast';
  const capability: Mode =
    mode === 'normal' || mode === 'ultra' || mode === 'lite' ? mode : 'normal';

  return (
    <View>
      {/* Fusion preview toggle */}
      <Pressable
        className="flex-row items-center py-2.5"
        onPress={() => onChange(fusionOn ? 'normal' : 'fusion')}
        accessibilityRole="switch"
        accessibilityState={{ checked: fusionOn }}
        accessibilityLabel="Fusion mode"
      >
        <Text className="text-text-hi text-text14">Fusion</Text>
        <Text className="text-brand-text text-text12 ml-2">Preview</Text>
        <View className="flex-1" />
        <View
          className={`w-10 h-6 rounded-chip p-0.5 ${fusionOn ? 'bg-brand' : 'bg-tint-primary'}`}
        >
          <View className={`w-5 h-5 rounded-chip bg-surface2 ${fusionOn ? 'ml-auto' : ''}`} />
        </View>
      </Pressable>

      <View className="border-b border-border-subtle my-1" />

      {/* Capability */}
      <Text className="text-text-low text-text12 py-1.5">Capability</Text>
      {CAPABILITIES.map(({ key, label, description }) => {
        const selected = !fusionOn && !fastOn && capability === key;
        return (
          <Pressable
            key={key}
            className="flex-row items-center py-2.5"
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityLabel={`${label} capability`}
            accessibilityState={{ selected }}
          >
            <View className="flex-1">
              <Text
                className={`text-text14 ${fusionOn || fastOn ? 'text-text-mid' : 'text-text-hi'}`}
              >
                {label}
              </Text>
              <Text className="text-text-low text-text12 mt-0.5">{description}</Text>
            </View>
            {selected && <Ionicons name="checkmark" size={16} color={checkColor} />}
          </Pressable>
        );
      })}

      <View className="border-b border-border-subtle my-1" />

      {/* Speed */}
      <Text className="text-text-low text-text12 py-1.5">Speed</Text>
      {(
        [
          { key: 'standard', label: 'Standard', description: 'Full quality at normal pace' },
          { key: 'fast', label: 'Fast', description: 'About 2× faster and 4× more expensive' },
        ] as const
      ).map(({ key, label, description }) => {
        const selected = key === 'fast' ? fastOn : !fastOn && !fusionOn;
        return (
          <Pressable
            key={key}
            className="flex-row items-center py-2.5"
            onPress={() => onChange(key === 'fast' ? 'fast' : capability)}
            accessibilityRole="button"
            accessibilityLabel={`${label} speed`}
            accessibilityState={{ selected }}
          >
            <View className="flex-1">
              <Text className={`text-text14 ${fusionOn ? 'text-text-mid' : 'text-text-hi'}`}>
                {label}
              </Text>
              <Text className="text-text-low text-text12 mt-0.5">{description}</Text>
            </View>
            {selected && <Ionicons name="checkmark" size={16} color={checkColor} />}
          </Pressable>
        );
      })}

      <View className="flex-row items-start mt-2">
        <Ionicons name="information-circle-outline" size={12} color={mutedColor} />
        <Text className="text-text-low text-text11 ml-1.5 flex-1">
          The API accepts one mode per session, so Fusion, Fast, and a capability can't be combined.
        </Text>
      </View>
    </View>
  );
}
