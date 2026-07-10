import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useConnections } from '@auth/ConnectionContext';
import { pairComputerFromQrPayload, type ComputerPairingStatus } from '@auth/computerPairing';
import {
  getQrScannerPermissionStatus,
  isQrScannerAvailable,
  requestQrScannerPermission,
} from '@auth/deviceSigning';
import { DevinXQrScanner } from '@components/connections/DevinXQrScanner';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

const STEPS = [
  'Open DevinX Desktop Bridge on your Mac.',
  'Choose Pair a phone to show a short-lived code.',
  'Scan it here, then approve this iPhone and its read access on your Mac.',
];

const STATUS_COPY: Record<ComputerPairingStatus, string> = {
  validating: 'Checking the pairing code…',
  submitting: 'Making a secure connection…',
  waiting_for_approval: 'Approve this iPhone on your Mac.',
  saving: 'Saving the paired Mac securely…',
  complete: 'Connected.',
};

const styles = StyleSheet.create({
  scanner: { width: '100%', height: '100%' },
});

type ScreenPhase = 'intro' | 'requesting_permission' | 'scanning' | 'pairing' | 'success';

export default function ComputerConnectionScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const { refreshComputers } = useConnections();
  const mode = useAppPreferences((state) => state.connectionMode);
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);
  const [computerName, setComputerName] = useState('My Mac');
  const [phase, setPhase] = useState<ScreenPhase>('intro');
  const [pairingStatus, setPairingStatus] = useState<ComputerPairingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  function resetForRetry(message?: string) {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('intro');
    setPairingStatus(null);
    setError(message ?? null);
  }

  function goBack() {
    abortRef.current?.abort();
    router.back();
  }

  function useCloudInstead() {
    abortRef.current?.abort();
    setConnectionMode('cloud');
    router.replace('/(onboarding)/credentials');
  }

  async function startScanning() {
    if (!computerName.trim()) {
      setError('Enter a name for this Mac.');
      return;
    }
    setError(null);
    setShowSettings(false);
    setPhase('requesting_permission');
    Keyboard.dismiss();
    try {
      if (!isQrScannerAvailable()) {
        throw new Error('scanner_unavailable');
      }
      let permission = await getQrScannerPermissionStatus();
      if (permission === 'notDetermined') permission = await requestQrScannerPermission();
      if (!mountedRef.current) return;
      if (permission !== 'authorized') {
        setShowSettings(permission === 'denied' || permission === 'restricted');
        resetForRetry('Camera access is required to scan the Desktop Bridge pairing code.');
        return;
      }
      setPhase('scanning');
    } catch {
      if (!mountedRef.current) return;
      resetForRetry('QR scanning requires the current DevinX iPhone build.');
    }
  }

  async function completePairing(payload: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('pairing');
    setPairingStatus('validating');
    setError(null);
    try {
      await pairComputerFromQrPayload(payload, {
        computerName: computerName.trim(),
        signal: controller.signal,
        onStatus: (status) => {
          if (mountedRef.current && !controller.signal.aborted) setPairingStatus(status);
        },
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      setPhase('success');
      setPairingStatus('complete');
      if (mode === 'cloud') setConnectionMode('both');
      await refreshComputers();
      if (mountedRef.current && !controller.signal.aborted) router.replace('/(main)');
    } catch {
      if (!mountedRef.current) return;
      resetForRetry(
        controller.signal.aborted
          ? 'Pairing was cancelled.'
          : 'Pairing could not be completed. Show a new code on your Mac and try again.',
      );
    }
  }

  function handleScannerError(code: string) {
    const message =
      code === 'invalid_code'
        ? 'That QR code is not a valid DevinX pairing code.'
        : 'The camera could not scan a pairing code. Try again.';
    resetForRetry(message);
  }

  const busy = phase === 'requesting_permission' || phase === 'pairing' || phase === 'success';
  const canScan = computerName.trim().length > 0 && !busy;

  return (
    <SafeAreaView className="flex-1 bg-surface0" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-6 py-8 flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          className="w-9 h-9 rounded-full bg-tint-secondary items-center justify-center mb-6"
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={tokens.textMid.hex} />
        </Pressable>

        <View className="w-14 h-14 rounded-card bg-tint-blue items-center justify-center mb-5">
          <Ionicons name="desktop-outline" size={27} color={tokens.brandText.hex} />
        </View>
        <Text className="text-text-hi text-text24 font-semibold mb-2">Connect your Mac</Text>
        <Text className="text-text-mid text-text14 leading-5 mb-7">
          Pair directly with a bridge you control. Your Devin CLI credentials stay on your Mac.
        </Text>

        <View className="bg-surface1 border border-border-subtle rounded-card px-4 py-2 mb-5">
          {STEPS.map((step, index) => (
            <View
              key={step}
              className={`flex-row items-start py-3 ${index < STEPS.length - 1 ? 'border-b border-border-subtle' : ''}`}
            >
              <View className="w-6 h-6 rounded-full bg-tint-blue items-center justify-center mr-3 mt-0.5">
                <Text className="text-brand-text text-text12 font-medium">{index + 1}</Text>
              </View>
              <Text className="text-text-mid text-text14 leading-5 flex-1">{step}</Text>
            </View>
          ))}
        </View>

        {phase === 'scanning' ? (
          <View className="mb-5">
            <View className="h-72 rounded-card overflow-hidden bg-surface2 border border-border">
              <DevinXQrScanner
                active
                style={styles.scanner}
                onCode={completePairing}
                onError={handleScannerError}
              />
              <View
                pointerEvents="none"
                className="absolute inset-10 rounded-card border-2 border-brand"
              />
            </View>
            <Text className="text-text-low text-text12 text-center mt-3">
              Point your camera at the code shown on your Mac.
            </Text>
            <Pressable
              className="mt-3 bg-tint-secondary rounded-button px-buttonPrimaryX py-buttonPrimaryY"
              onPress={() => resetForRetry()}
              accessibilityRole="button"
              accessibilityLabel="Cancel QR scanning"
            >
              <Text className="text-text-hi text-text14 font-medium text-center">Cancel</Text>
            </Pressable>
          </View>
        ) : phase === 'pairing' || phase === 'success' ? (
          <View className="bg-surface1 border border-border-subtle rounded-card px-5 py-6 items-center mb-5">
            {phase === 'pairing' ? (
              <ActivityIndicator size="large" color={tokens.brand.hex} />
            ) : (
              <Ionicons name="checkmark-circle" size={34} color={tokens.finished.hex} />
            )}
            <Text className="text-text-hi text-text14 font-medium mt-4 text-center">
              {pairingStatus ? STATUS_COPY[pairingStatus] : 'Connecting…'}
            </Text>
            {pairingStatus === 'waiting_for_approval' && (
              <Text className="text-text-low text-text12 leading-4 text-center mt-2">
                Choose metadata-only or read-only session content on the Mac. The request expires
                automatically if it is not approved.
              </Text>
            )}
            {phase === 'pairing' && (
              <Pressable
                className="mt-4 px-4 py-2"
                onPress={() => resetForRetry('Pairing was cancelled.')}
                accessibilityRole="button"
                accessibilityLabel="Cancel computer pairing"
              >
                <Text className="text-link text-text13">Cancel</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View className="mb-4">
              <Text className="text-text-mid text-text13 mb-2">Name this Mac</Text>
              <TextInput
                className="bg-surface2 border border-border rounded-input px-4 py-3 text-text14 text-text-hi"
                value={computerName}
                onChangeText={setComputerName}
                placeholder="My Mac"
                placeholderTextColor={tokens.textLow.hex}
                maxLength={80}
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel="Paired Mac name"
              />
            </View>

            {error && (
              <View className="mb-4 bg-tint-red rounded-card px-4 py-3">
                <Text className="text-failed text-text13 leading-5">{error}</Text>
                {showSettings && (
                  <Pressable
                    className="mt-2 self-start"
                    onPress={() => Linking.openSettings().catch(() => {})}
                    accessibilityRole="button"
                    accessibilityLabel="Open iPhone settings"
                  >
                    <Text className="text-link text-text13 font-medium">Open Settings</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Pressable
              className={`rounded-button px-buttonPrimaryX py-buttonPrimaryY ${canScan ? 'bg-brand' : 'bg-tint-secondary'}`}
              disabled={!canScan}
              onPress={startScanning}
              accessibilityRole="button"
              accessibilityLabel="Scan Desktop Bridge pairing code"
            >
              {phase === 'requesting_permission' ? (
                <ActivityIndicator size="small" color={tokens.textAlwaysWhite.hex} />
              ) : (
                <Text
                  className={`text-center text-text14 font-medium ${canScan ? 'text-text-always-white' : 'text-text-low'}`}
                >
                  Scan pairing code
                </Text>
              )}
            </Pressable>
          </>
        )}

        {mode === 'computer' && phase === 'intro' && (
          <Pressable
            className="border border-border rounded-button px-buttonPrimaryX py-buttonPrimaryY mt-3"
            onPress={useCloudInstead}
            accessibilityRole="button"
            accessibilityLabel="Connect Devin Cloud instead"
          >
            <Text className="text-text-hi text-text14 font-medium text-center">
              Connect Devin Cloud instead
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
