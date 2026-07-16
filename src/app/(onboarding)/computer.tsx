import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useConnections } from '@auth/ConnectionContext';
import {
  ComputerBridgeError,
  disconnectComputer,
  getComputerBridgeVersion,
  removeComputerFromThisIPhone,
} from '@auth/computerBridge';
import { pairComputerFromQrPayload, type ComputerPairingStatus } from '@auth/computerPairing';
import {
  getQrScannerPermissionStatus,
  isQrScannerAvailable,
  requestQrScannerPermission,
} from '@auth/deviceSigning';
import { DevinXQrScanner } from '@components/connections/DevinXQrScanner';
import { CONNECTOR_RELEASE_PAGE, CONNECTOR_SETUP_PROMPT } from '@lib/connectorSetup';
import {
  isConnectorUpdateRequired,
  MINIMUM_SUPPORTED_CONNECTOR_VERSION,
} from '@lib/connectorVersion';
import { useAppPreferences } from '@store/preferences';
import { useTheme } from '@theme/index';

const STEPS = [
  'Send the assisted setup prompt to an AI assistant on your Mac.',
  'Approve the signed install, Tailscale login, and visible background setting on your Mac.',
  'Scan its code, then approve this iPhone on your Mac.',
];

const TAILSCALE_IOS_GUIDE = 'https://tailscale.com/docs/install/ios';

const STATUS_COPY: Record<ComputerPairingStatus, string> = {
  validating: 'Checking the pairing code…',
  checking_bridge_identity: 'Verifying the Mac identity…',
  loading_existing_pairing: 'Checking saved computer access…',
  creating_device_identity: 'Creating this iPhone’s secure key…',
  preparing_secure_request: 'Preparing the signed pairing request…',
  submitting: 'Making a secure connection…',
  waiting_for_approval: 'Approve this iPhone on your Mac.',
  saving: 'Saving the paired Mac securely…',
  complete: 'Connected.',
};

const styles = StyleSheet.create({
  scanner: { width: '100%', height: '100%' },
});

type ScreenPhase = 'intro' | 'requesting_permission' | 'scanning' | 'pairing' | 'success';

function pairingFailureMessage(error: unknown, stage: ComputerPairingStatus | null): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'ERR_PINNED_HTTPS_NETWORK') {
    return 'DevinX could not reach DevinX Connector. Confirm Tailscale is connected on this iPhone and Mac, then generate a new code.';
  }
  if (code === 'unavailable' && stage === 'submitting') {
    return 'The signed request could not reach DevinX Connector through Tailscale.';
  }
  if (code === 'ERR_PINNED_HTTPS_CERTIFICATE_MISMATCH') {
    return 'The pairing code no longer matches DevinX Connector. Generate a new code and scan it again.';
  }
  if (
    code === 'ERR_PINNED_HTTPS_INVALID_INPUT' ||
    code === 'ERR_PINNED_HTTPS_INVALID_RESPONSE' ||
    code === 'ERR_PINNED_HTTPS_RESPONSE_TOO_LARGE'
  ) {
    return 'DevinX and DevinX Connector are not using a compatible secure connection. Update both and try again.';
  }
  if (stage === 'checking_bridge_identity') {
    return 'This iPhone could not verify the Connector identity in the pairing code.';
  }
  if (stage === 'loading_existing_pairing') {
    return 'This iPhone could not validate its saved computer-pairing state.';
  }
  if (stage === 'creating_device_identity') {
    return 'This iPhone could not create its secure computer-signing key in Keychain.';
  }
  if (stage === 'preparing_secure_request') {
    return 'This iPhone could not prepare the signed pairing request.';
  }
  return 'Pairing could not be completed. Generate a new code in DevinX Connector and try again.';
}

export default function ComputerConnectionScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { computers = [], refreshComputers } = useConnections();
  const mode = useAppPreferences((state) => state.connectionMode);
  const setConnectionMode = useAppPreferences((state) => state.setConnectionMode);
  const isCombinedSetup = mode === 'both';
  const [computerName, setComputerName] = useState('My Mac');
  const [phase, setPhase] = useState<ScreenPhase>('intro');
  const [pairingStatus, setPairingStatus] = useState<ComputerPairingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [removingBridgeId, setRemovingBridgeId] = useState<string | null>(null);
  const [updateRequiredBridgeIds, setUpdateRequiredBridgeIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    mountedRef.current = true;
    const keyboardSubscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      keyboardSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (computers.length === 0) return undefined;
    let cancelled = false;
    Promise.all(
      computers.map(async (computer) => {
        try {
          const status = await getComputerBridgeVersion(computer.bridgeId);
          return status.kind === 'legacy' || isConnectorUpdateRequired(status.version)
            ? computer.bridgeId
            : null;
        } catch {
          return null;
        }
      }),
    ).then((bridgeIds) => {
      if (!cancelled) setUpdateRequiredBridgeIds(new Set(bridgeIds.filter(Boolean) as string[]));
    });
    return () => {
      cancelled = true;
    };
  }, [computers]);

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

  function confirmDisconnect(bridgeId: string, computerLabel: string) {
    Alert.alert(
      `Disconnect ${computerLabel}?`,
      'This revokes this iPhone on the Mac, then erases its local pairing key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setRemovingBridgeId(bridgeId);
            disconnectComputer(bridgeId)
              .then(refreshComputers)
              .catch((disconnectError: unknown) => {
                if (
                  disconnectError instanceof ComputerBridgeError &&
                  disconnectError.code === 'unavailable'
                ) {
                  Alert.alert(
                    'Mac unavailable',
                    'DevinX cannot revoke this iPhone on the Mac while Connector is offline. You can retry later, or remove the pairing key from this iPhone now. The inactive Mac record will remain until you revoke it in DevinX Connector.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove from this iPhone',
                        style: 'destructive',
                        onPress: () => {
                          setRemovingBridgeId(bridgeId);
                          removeComputerFromThisIPhone(bridgeId)
                            .then(refreshComputers)
                            .catch(() =>
                              setError(
                                'The local computer pairing could not be removed securely. Try again.',
                              ),
                            )
                            .finally(() => setRemovingBridgeId(null));
                        },
                      },
                    ],
                  );
                  return;
                }
                setError(
                  'The computer could not be securely disconnected. Open DevinX Connector and try again.',
                );
              })
              .finally(() => setRemovingBridgeId(null));
          },
        },
      ],
    );
  }

  function shareAssistedSetup() {
    setError(null);
    Share.share({
      title: 'Set up DevinX Connector',
      message: CONNECTOR_SETUP_PROMPT,
    }).catch(() => setError('The assisted setup prompt could not be shared. Try again.'));
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
        resetForRetry('Camera access is required to scan the DevinX Connector pairing code.');
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
    let latestStatus: ComputerPairingStatus | null = 'validating';
    try {
      await pairComputerFromQrPayload(payload, {
        computerName: computerName.trim(),
        signal: controller.signal,
        onStatus: (status) => {
          latestStatus = status;
          if (mountedRef.current && !controller.signal.aborted) setPairingStatus(status);
        },
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      setPhase('success');
      setPairingStatus('complete');
      if (mode === 'cloud') setConnectionMode('both');
      await refreshComputers();
      if (mountedRef.current && !controller.signal.aborted) router.replace('/(main)');
    } catch (pairingError) {
      if (!mountedRef.current) return;
      resetForRetry(
        controller.signal.aborted
          ? 'Pairing was cancelled.'
          : pairingFailureMessage(pairingError, latestStatus),
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
      <Modal
        visible={phase === 'scanning'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => resetForRetry()}
      >
        <View
          className="flex-1 bg-surface0 px-4"
          style={{
            paddingTop: Math.max(insets.top, 16) + 12,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-4">
              <Text className="text-text-hi text-text20 font-semibold">Scan pairing code</Text>
              <Text className="text-text-low text-text12 leading-4 mt-1">
                Point your camera at the code shown in DevinX Connector.
              </Text>
            </View>
            <Pressable
              className="w-10 h-10 rounded-full bg-tint-secondary items-center justify-center"
              onPress={() => resetForRetry()}
              accessibilityRole="button"
              accessibilityLabel="Cancel QR scanning"
            >
              <Ionicons name="close" size={22} color={tokens.textMid.hex} />
            </Pressable>
          </View>

          <View className="w-full aspect-square rounded-card overflow-hidden bg-surface2 border border-border">
            <DevinXQrScanner
              active={phase === 'scanning'}
              style={styles.scanner}
              onCode={completePairing}
              onError={handleScannerError}
            />
            <View
              pointerEvents="none"
              className="absolute inset-7 rounded-card border-2 border-brand"
            />
          </View>
          <Text className="text-text-low text-text12 text-center mt-3">
            Hold the code inside the frame.
          </Text>
        </View>
      </Modal>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        testID="computer-connection-keyboard-viewport"
      >
        <ScrollView
          ref={scrollRef}
          contentContainerClassName="px-6 py-8 flex-grow"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          testID="computer-connection-scroll"
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
          {isCombinedSetup && (
            <Text className="text-brand-text text-text12 font-semibold tracking-wider mb-3">
              STEP 2 OF 2
            </Text>
          )}
          <Text className="text-text-hi text-text24 font-semibold mb-2">
            {isCombinedSetup ? 'Pair your computer' : 'Connect your Mac'}
          </Text>
          <Text className="text-text-mid text-text14 leading-5 mb-7">
            {isCombinedSetup
              ? 'Devin Cloud is connected. Tailscale provides the private route to your Mac; Connector provides authorized local session access.'
              : 'Tailscale provides the private route to your Mac. Connector provides authorized local session access; your Devin credentials stay on your Mac.'}
          </Text>

          {computers.length === 0 && (
            <View className="bg-surface1 border border-border-subtle rounded-card px-4 py-4 mb-5">
              <View className="flex-row items-start">
                <View className="w-9 h-9 rounded-input bg-tint-blue items-center justify-center mr-3">
                  <Ionicons name="sparkles-outline" size={18} color={tokens.brandText.hex} />
                </View>
                <View className="flex-1">
                  <Text className="text-text-hi text-text14 font-semibold">
                    Set up DevinX Connector
                  </Text>
                  <Text className="text-text-mid text-text12 leading-4 mt-1">
                    Tailscale alone does not expose Devin sessions. Send a guarded setup prompt to
                    install the signed local service that connects DevinX to Devin for Terminal.
                  </Text>
                </View>
              </View>

              <Pressable
                className="bg-brand rounded-button px-buttonPrimaryX py-buttonPrimaryY mt-4"
                onPress={shareAssistedSetup}
                accessibilityRole="button"
                accessibilityLabel="Share assisted DevinX Connector setup prompt"
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="share-outline" size={17} color={tokens.textAlwaysWhite.hex} />
                  <Text className="text-text-always-white text-text14 font-medium ml-2">
                    Send assisted setup prompt
                  </Text>
                </View>
              </Pressable>

              <Pressable
                className="border border-border rounded-button px-buttonPrimaryX py-buttonPrimaryY mt-3"
                onPress={() => Linking.openURL(CONNECTOR_RELEASE_PAGE).catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel="Open official DevinX Connector releases"
              >
                <Text className="text-text-hi text-text13 font-medium text-center">
                  Open official releases
                </Text>
              </Pressable>

              <Text className="text-text-low text-text11 leading-4 text-center mt-3">
                Already installed? Continue below to name this Mac and scan its pairing code.
              </Text>
            </View>
          )}

          {computers.length > 0 && (
            <View className="mb-6">
              <Text className="text-text-mid text-text13 mb-2">Paired computers</Text>
              <View className="rounded-card border border-border-subtle bg-surface1">
                {computers.map((computer, index) => (
                  <View
                    key={computer.bridgeId}
                    className={`flex-row items-center px-4 py-3 ${index < computers.length - 1 ? 'border-b border-border-subtle' : ''}`}
                  >
                    <Ionicons name="desktop-outline" size={18} color={tokens.brandText.hex} />
                    <View className="ml-3 flex-1">
                      <Text className="text-text-hi text-text14">{computer.computerName}</Text>
                      <Text className="mt-0.5 text-text-low text-text12">Tailscale</Text>
                    </View>
                    <Pressable
                      className="px-2 py-2"
                      onPress={() => confirmDisconnect(computer.bridgeId, computer.computerName)}
                      disabled={removingBridgeId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Disconnect ${computer.computerName}`}
                    >
                      {removingBridgeId === computer.bridgeId ? (
                        <ActivityIndicator size="small" color={tokens.failed.hex} />
                      ) : (
                        <Text className="text-failed text-text12 font-medium">Disconnect</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
              {updateRequiredBridgeIds.size > 0 && (
                <View className="bg-tint-blue border border-border-subtle rounded-card px-4 py-3 mt-3">
                  <View className="flex-row items-start">
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={18}
                      color={tokens.brandText.hex}
                    />
                    <View className="ml-2 flex-1">
                      <Text className="text-text-hi text-text13 font-semibold">
                        Connector update required
                      </Text>
                      <Text className="text-text-mid text-text12 leading-4 mt-1">
                        Install DevinX Connector {MINIMUM_SUPPORTED_CONNECTOR_VERSION} or later to
                        keep computer sessions compatible.
                      </Text>
                      <Pressable
                        className="mt-2 self-start"
                        onPress={() => Linking.openURL(CONNECTOR_RELEASE_PAGE).catch(() => {})}
                        accessibilityRole="link"
                        accessibilityLabel="Open official DevinX Connector update"
                      >
                        <Text className="text-link text-text12 font-medium">
                          Open official release
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          <Text className="text-text-mid text-text13 mb-2">Private connection</Text>
          <View className="bg-tint-blue rounded-card px-4 py-3 mb-4">
            <View className="flex-row items-start">
              <Ionicons name="shield-checkmark-outline" size={16} color={tokens.brandText.hex} />
              <Text className="text-brand-text text-text12 leading-4 ml-2 flex-1">
                Tailscale supplies the private network. Connector supplies the local Devin service,
                and DevinX verifies the Mac and this iPhone for every request.
              </Text>
            </View>
            <Pressable
              className="mt-2 self-start"
              onPress={() => Linking.openURL(TAILSCALE_IOS_GUIDE).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel="Open Tailscale setup guide"
            >
              <Text className="text-brand-text text-text12 font-medium">
                Open Tailscale setup guide
              </Text>
            </Pressable>
          </View>

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

          {phase === 'pairing' || phase === 'success' ? (
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
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  onSubmitEditing={Keyboard.dismiss}
                  placeholder="My Mac"
                  placeholderTextColor={tokens.textLow.hex}
                  maxLength={80}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
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
                accessibilityLabel="Scan DevinX Connector pairing code"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
