import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@theme/index';

export interface ComputerGrants {
  viewSessions: boolean;
  sendPrompts: boolean;
  startSessions: boolean;
}

export function ComputerPermissionsSheet(props: {
  visible: boolean;
  onClose: () => void;
  computerName: string;
  grants: ComputerGrants;
  source: 'connector' | 'pairing';
}) {
  const { visible, onClose, computerName, grants, source } = props;
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const rows = [
    { id: 'view', label: 'View sessions', allowed: grants.viewSessions },
    { id: 'prompt', label: 'Send prompts', allowed: grants.sendPrompts },
    { id: 'create', label: 'Start sessions', allowed: grants.startSessions },
  ] as const;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-scrim"
        onPress={onClose}
        accessibilityLabel="Close permissions"
      >
        <View
          className="rounded-t-sheet bg-surface2 px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          accessibilityViewIsModal
        >
          <Text className="mb-4 text-text-hi text-text17">
            Permissions on {computerName}
          </Text>
          {rows.map((row) => (
            <View
              key={row.id}
              className="mb-2 flex-row items-center rounded-card border border-border-subtle bg-surface1 px-4 py-3"
              testID={`permission-row-${row.id}`}
            >
              <Ionicons
                name={row.allowed ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={row.allowed ? tokens.finished.hex : tokens.textLow.hex}
              />
              <Text className="ml-3 flex-1 text-text-hi text-text14">{row.label}</Text>
              <Text
                className={
                  row.allowed ? 'text-finished text-text12' : 'text-text-low text-text12'
                }
              >
                {row.allowed ? 'Allowed' : 'Not allowed'}
              </Text>
            </View>
          ))}
          <Text className="mt-3 text-text-mid text-text13 leading-5">
            Permissions are managed in DevinX Connector on {computerName}. Open it and change
            what this iPhone is allowed to do — you don't need to pair again.
          </Text>
          {source === 'pairing' && (
            <Text className="mt-2 text-text-low text-text12 leading-4">
              Shown as granted when this iPhone was paired. Update DevinX Connector to see its
              current permissions.
            </Text>
          )}
          <Pressable
            className="mt-5 items-center rounded-card bg-brand px-5 py-3"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text className="text-text-always-white text-text14 font-medium">Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
