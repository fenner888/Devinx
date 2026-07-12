import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@theme/index';
import type { VoiceComposerController } from './useVoiceComposer';

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function VoiceMicButton({
  voice,
  disabled = false,
}: {
  voice: VoiceComposerController;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const busy = voice.phase === 'preparing';
  // The expanded recording row owns Stop and Cancel while the microphone is
  // live. Hiding the compact control avoids presenting two Stop actions.
  if (voice.isRecording) return null;
  return (
    <Pressable
      className="h-11 w-11 items-center justify-center rounded-full"
      onPress={voice.start}
      disabled={disabled || voice.phase === 'stopping' || voice.phase === 'structuring'}
      accessibilityRole="button"
      accessibilityLabel="Start on-device dictation"
      accessibilityState={{ disabled: disabled || voice.phase === 'stopping', busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.brandText.hex} />
      ) : (
        <Ionicons name="mic-outline" size={20} color={tokens.textMid.hex} />
      )}
    </Pressable>
  );
}

function Waveform({ level, reduceMotion }: { level: number; reduceMotion: boolean }) {
  const bars = [0.48, 0.76, 1, 0.7, 0.42];
  const heightClass = (multiplier: number) => {
    if (reduceMotion) return 'h-2';
    const scaled = level * multiplier;
    if (scaled >= 0.8) return 'h-7';
    if (scaled >= 0.6) return 'h-6';
    if (scaled >= 0.4) return 'h-4';
    if (scaled >= 0.2) return 'h-3';
    return 'h-1.5';
  };
  return (
    <View className="h-8 flex-row items-center gap-1" accessibilityElementsHidden>
      {bars.map((multiplier, index) => (
        <View
          key={index}
          className={`w-1 rounded-full bg-brand ${heightClass(multiplier)}`}
        />
      ))}
    </View>
  );
}

export function VoiceComposerStatus({ voice }: { voice: VoiceComposerController }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      {voice.isRecording && (
        <View
          className="mx-1 mb-2 overflow-hidden rounded-input bg-tint-blue px-3 py-2"
          accessibilityLabel={`Recording dictation, ${formatElapsed(voice.elapsedSeconds)}`}
        >
          <View className="min-h-11 flex-row items-center">
            <View className="mr-2 h-2 w-2 rounded-full bg-failed" />
            <Waveform level={voice.level} reduceMotion={voice.reduceMotion} />
            <View className="ml-3 flex-1">
              <Text className="text-brand-text text-text13 font-medium">Listening</Text>
              <Text className="mt-0.5 font-mono text-text-mid text-text11">
                {formatElapsed(voice.elapsedSeconds)} · On device
              </Text>
            </View>
            <Pressable
              className="mr-1 h-11 w-11 items-center justify-center rounded-full bg-tint-secondary"
              onPress={voice.cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel dictation and discard unfinished words"
            >
              <Ionicons name="close" size={20} color={tokens.textMid.hex} />
            </Pressable>
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-brand"
              onPress={voice.stop}
              disabled={voice.phase === 'stopping'}
              accessibilityRole="button"
              accessibilityLabel="Stop dictation"
            >
              {voice.phase === 'stopping' ? (
                <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
              ) : (
                <Ionicons name="stop" size={18} color={tokens.textAlwaysWhite.hex} />
              )}
            </Pressable>
          </View>
          {voice.elapsedSeconds >= 300 && (
            <Text className="mt-1 text-blocked text-text12">Recording has passed five minutes.</Text>
          )}
        </View>
      )}

      {voice.canStructure && !voice.isRecording && (
        <Pressable
          className="mx-1 mb-2 self-start flex-row items-center rounded-full bg-tint-blue px-3 py-2"
          onPress={voice.structure}
          disabled={voice.phase === 'structuring'}
          accessibilityRole="button"
          accessibilityLabel="Preview organized Devin prompt"
        >
          {voice.phase === 'structuring' ? (
            <ActivityIndicator size="small" color={tokens.brandText.hex} />
          ) : (
            <Ionicons name="sparkles-outline" size={15} color={tokens.brandText.hex} />
          )}
          <Text className="ml-2 text-brand-text text-text13 font-medium">Organize prompt</Text>
        </Pressable>
      )}

      {voice.error && (
        <View className="mx-1 mb-2 flex-row items-start rounded-input bg-tint-red px-3 py-2">
          <Text className="flex-1 text-failed text-text12">{voice.error}</Text>
          {voice.permissionDenied && (
            <Pressable
              className="ml-2 min-h-11 justify-center"
              onPress={voice.openSettings}
              accessibilityRole="button"
              accessibilityLabel="Open iOS Settings"
            >
              <Text className="text-brand-text text-text12 font-medium">Open Settings</Text>
            </Pressable>
          )}
          {!voice.permissionDenied && (
            <Pressable
              className="ml-2 h-11 w-11 items-center justify-center"
              onPress={voice.clearError}
              accessibilityRole="button"
              accessibilityLabel="Dismiss dictation message"
            >
              <Ionicons name="close" size={17} color={tokens.textMid.hex} />
            </Pressable>
          )}
        </View>
      )}

      <Modal
        visible={Boolean(voice.scribePreview)}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={voice.closePreview}
      >
        <View className="flex-1 justify-end bg-scrim">
          <View
            className="max-h-[88%] rounded-t-sheet bg-surface2 px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-text-hi text-text17 font-medium">Organized prompt preview</Text>
                <Text className="mt-1 text-text-mid text-text12">
                  {voice.scribePreview?.kind === 'foundationModel'
                    ? 'Structured privately with Apple Intelligence on this device.'
                    : 'Organized with DevinX’s private on-device template.'}{' '}
                  Nothing is sent until you approve and submit it.
                </Text>
              </View>
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-tint-secondary"
                onPress={voice.closePreview}
                accessibilityRole="button"
                accessibilityLabel="Close structure preview"
              >
                <Ionicons name="close" size={19} color={tokens.textMid.hex} />
              </Pressable>
            </View>
            <ScrollView className="min-h-0" contentContainerClassName="pb-3">
              <Text className="mb-2 text-text-mid text-text12 font-medium uppercase">Before</Text>
              <View className="mb-4 rounded-input bg-surface1 p-3">
                <Text className="text-text-mid text-text13 leading-5">{voice.rawPreview}</Text>
              </View>
              <Text className="mb-2 text-text-mid text-text12 font-medium uppercase">After</Text>
              <View className="rounded-input border border-border bg-surface1 p-3">
                <Text className="text-text-hi text-text13 leading-5">
                  {voice.scribePreview?.text}
                </Text>
              </View>
            </ScrollView>
            <View className="flex-row gap-3 pt-2">
              <Pressable
                className="min-h-12 flex-1 items-center justify-center rounded-button bg-tint-secondary"
                onPress={voice.closePreview}
                accessibilityRole="button"
                accessibilityLabel="Keep raw dictation"
              >
                <Text className="text-text-hi text-text14 font-medium">Keep raw</Text>
              </Pressable>
              <Pressable
                className="min-h-12 flex-1 items-center justify-center rounded-button bg-brand"
                onPress={voice.applyStructured}
                accessibilityRole="button"
                accessibilityLabel="Use organized prompt"
              >
                <Text className="text-always-white text-text14 font-medium">Use organized</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
