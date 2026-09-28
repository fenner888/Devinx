import { Text } from 'react-native';

import {
  useComputerSessionPermission,
  useRespondComputerSessionPermission,
} from '@api/bridge/queries';
import type {
  ComputerSessionPermissionDecision,
} from '@auth/computerBridge';
import { ComputerPermissionCard } from '@components/sessions/ComputerPermissionCard';

interface ComputerPermissionDockItemProps {
  bridgeId: string;
  sessionId: string;
  onAnswered(text: string): void;
}

function answeredText(decision: ComputerSessionPermissionDecision): string {
  switch (decision) {
    case 'allow_once':
      return 'You allowed this command once';
    case 'allow_session':
      return 'You allowed this command for this session';
    case 'reject_once':
      return 'You denied this command';
  }
}

export function ComputerPermissionDockItem({
  bridgeId,
  sessionId,
  onAnswered,
}: ComputerPermissionDockItemProps) {
  const permission = useComputerSessionPermission(bridgeId, sessionId);
  const response = useRespondComputerSessionPermission(bridgeId, sessionId);

  if (!permission.data) {
    return (
      <Text className="px-4 py-3 text-text-low text-text12">
        Loading approval…
      </Text>
    );
  }
  const activePermission = permission.data;

  return (
    <ComputerPermissionCard
      permission={activePermission}
      pending={response.isPending}
      error={
        response.error
          ? 'Your decision could not be sent securely. Try again.'
          : undefined
      }
      onRespond={(decision) =>
        response.mutate(
          { permissionId: activePermission.id, decision },
          { onSuccess: () => onAnswered(answeredText(decision)) },
        )
      }
    />
  );
}
