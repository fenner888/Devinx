import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

export function ComputerInteractionDock({
  children,
  bottom,
  maxHeight,
  onHeightChange,
}: {
  children: ReactNode;
  bottom: number;
  maxHeight: number;
  onHeightChange(height: number): void;
}) {
  return (
    <View
      className="absolute inset-x-3 z-10"
      style={{ bottom, maxHeight }}
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
      testID="computer-interaction-dock"
    >
      <ScrollView
        className="rounded-card"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ComputerInteractionAnsweredRow({ sentence }: { sentence: string }) {
  return (
    <View className="flex-row items-center rounded-card border border-border bg-surface1 px-4 py-3">
      <View className="mr-2 h-2 w-2 rounded-dot bg-brand" />
      <Text className="flex-1 text-text-mid text-text12" numberOfLines={2}>
        {sentence}
      </Text>
    </View>
  );
}
