import { requireNativeViewManager } from 'expo-modules-core';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

interface CodeEvent {
  payload: string;
}

interface ErrorEvent {
  code: 'permission_required' | 'camera_unavailable' | 'configuration_failed' | 'invalid_code';
}

interface NativeScannerProps extends ViewProps {
  active: boolean;
  onCode: (event: NativeSyntheticEvent<CodeEvent>) => void;
  onError: (event: NativeSyntheticEvent<ErrorEvent>) => void;
}

const NativeScanner = requireNativeViewManager<NativeScannerProps>('DevinXDeviceCrypto');

export interface DevinXQrScannerProps extends ViewProps {
  active: boolean;
  onCode: (payload: string) => void;
  onError: (code: ErrorEvent['code']) => void;
}

export function DevinXQrScanner({ active, onCode, onError, ...viewProps }: DevinXQrScannerProps) {
  return (
    <NativeScanner
      {...viewProps}
      active={active}
      onCode={(event) => onCode(event.nativeEvent.payload)}
      onError={(event) => onError(event.nativeEvent.code)}
    />
  );
}
