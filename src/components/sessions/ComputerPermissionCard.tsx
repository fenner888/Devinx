import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type {
  ComputerSessionPermission,
  ComputerSessionPermissionDecision,
} from '@auth/computerBridge';
import { useTheme } from '@theme/index';

interface ComputerPermissionCardProps {
  permission: ComputerSessionPermission;
  pending: boolean;
  error?: string;
  onRespond(decision: ComputerSessionPermissionDecision): void;
}

export function ComputerPermissionCard({
  permission,
  pending,
  error,
  onRespond,
}: ComputerPermissionCardProps) {
  const { tokens } = useTheme();
  const hasDecision = (decision: ComputerSessionPermissionDecision) =>
    permission.decisions.includes(decision);

  return (
    <View className="rounded-card border border-brand bg-surface1 px-4 py-4">
      <Text className="text-brand-text text-text12 font-medium">Devin wants to run a command</Text>
      <Text className="mt-1 text-text-hi text-text16 font-medium">{permission.title}</Text>
      {permission.command && (
        <Text className="mt-3 rounded-card bg-surface2 px-3 py-2 font-mono text-text-hi text-text12">
          $ {permission.command}
        </Text>
      )}
      {permission.paths && permission.paths.length > 0 && (
        <View className="mt-3">
          {permission.paths.map((path) => (
            <Text className="mt-1 text-text-mid text-text12" key={path}>
              {path}
            </Text>
          ))}
        </View>
      )}
      {error && <Text className="mt-3 text-failed text-text12">{error}</Text>}
      {pending && (
        <View className="mt-3 flex-row items-center">
          <ActivityIndicator size="small" color={tokens.brand.hex} />
          <Text className="ml-2 text-text-mid text-text12">Sending your decision…</Text>
        </View>
      )}
      <View className="mt-4 flex-row flex-wrap justify-end gap-2">
        {hasDecision('reject_once') && (
          <Pressable
            className="min-h-11 justify-center rounded-full border border-border px-4"
            onPress={() => onRespond('reject_once')}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="Deny command"
            accessibilityState={{ disabled: pending }}
          >
            <Text className="text-text-mid text-text13">Deny</Text>
          </Pressable>
        )}
        {hasDecision('allow_session') && (
          <Pressable
            className="min-h-11 justify-center rounded-full border border-border px-4"
            onPress={() => onRespond('allow_session')}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="Allow command for this session"
            accessibilityState={{ disabled: pending }}
          >
            <Text className="text-text-mid text-text13">Allow for this session</Text>
          </Pressable>
        )}
        {hasDecision('allow_once') && (
          <Pressable
            className={`min-h-11 min-w-20 items-center justify-center rounded-full px-4 ${pending ? 'bg-tint-secondary' : 'bg-brand'}`}
            onPress={() => onRespond('allow_once')}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel="Allow command once"
            accessibilityState={{ disabled: pending }}
          >
            <Text className="text-text-always-white text-text13 font-medium">Allow</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
