/**
 * Cross-platform confirmation dialog. `Alert.alert` is a silent no-op on
 * react-native-web, which made archive/terminate/disconnect dead on web —
 * fall back to `window.confirm` there.
 */
import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}

export function confirmAction(
  { title, message, confirmLabel, destructive }: ConfirmOptions,
  onConfirm: () => void,
  onCancel?: () => void,
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
