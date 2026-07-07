/**
 * Skeleton placeholders — shimmer-like loading states for board and detail.
 */

import { View, Text, Pressable } from 'react-native';

export function SkeletonRow() {
  return (
    <View className="flex-row items-center bg-surface1 rounded-card px-4 py-3 mb-2">
      <View className="w-2 h-2 rounded-full bg-tint-secondary mr-3" />
      <View className="flex-1">
        <View className="h-4 bg-tint-secondary rounded-sm w-3/4 mb-2" />
        <View className="h-3 bg-tint-secondary rounded-sm w-1/2" />
      </View>
    </View>
  );
}

export function BoardSkeleton() {
  return (
    <View className="px-4 pt-2">
      <View className="py-2">
        <View className="h-3 bg-tint-secondary rounded-sm w-24 mb-3" />
      </View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <View className="py-2 mt-2">
        <View className="h-3 bg-tint-secondary rounded-sm w-20 mb-3" />
      </View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

export function SessionDetailSkeleton() {
  return (
    <View className="px-4 py-3">
      {/* Header */}
      <View className="flex-row items-center mb-2">
        <View className="h-3 bg-tint-secondary rounded-sm w-16 mr-3" />
        <View className="w-2 h-2 rounded-full bg-tint-secondary mr-2" />
        <View className="h-3 bg-tint-secondary rounded-sm w-20" />
      </View>
      <View className="h-5 bg-tint-secondary rounded-sm w-2/3 mb-2" />
      <View className="h-3 bg-tint-secondary rounded-sm w-1/2 mb-4" />
      {/* Tab bar */}
      <View className="flex-row border-b border-border-subtle mb-4">
        <View className="flex-1 py-3 items-center">
          <View className="h-4 bg-tint-secondary rounded-sm w-16" />
        </View>
        <View className="flex-1 py-3 items-center">
          <View className="h-4 bg-tint-secondary rounded-sm w-16" />
        </View>
        <View className="flex-1 py-3 items-center">
          <View className="h-4 bg-tint-secondary rounded-sm w-16" />
        </View>
      </View>
      {/* Message bubbles */}
      <View className="mb-3">
        <View className="bg-surface1 rounded-card px-4 py-3 w-3/4 mb-1">
          <View className="h-3 bg-tint-secondary rounded-sm w-full mb-2" />
          <View className="h-3 bg-tint-secondary rounded-sm w-2/3" />
        </View>
      </View>
      <View className="mb-3 self-end">
        <View className="bg-tint-secondary rounded-card px-4 py-3 w-2/3 mb-1">
          <View className="h-3 bg-tint-secondary rounded-sm w-full mb-2" />
          <View className="h-3 bg-tint-secondary rounded-sm w-1/2" />
        </View>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="font-mono text-brand text-text14 mb-3">{icon}</Text>
      <Text className="text-text-hi text-text14 text-center mb-2">{title}</Text>
      <Text className="text-text-mid text-text13 text-center">{message}</Text>
    </View>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="font-mono text-failed text-text14 mb-3">{'X_X'}</Text>
      <Text className="text-failed text-text14 mb-2">{title}</Text>
      <Text className="text-text-mid text-text13 text-center mb-4">{message}</Text>
      {onRetry && (
        <Pressable
          className="bg-tint-secondary rounded-button px-buttonSecondaryX py-2"
          onPress={onRetry}
        >
          <Text className="text-brand text-text14 font-medium">Try again</Text>
        </Pressable>
      )}
    </View>
  );
}
