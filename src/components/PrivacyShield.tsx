import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

export function shouldShowPrivacyShield(
  status: AppStateStatus,
  platform: typeof Platform.OS = Platform.OS,
): boolean {
  return platform !== 'web' && status !== 'active';
}

export function PrivacyShield() {
  const [visible, setVisible] = useState(() => shouldShowPrivacyShield(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      setVisible(shouldShowPrivacyShield(status));
    });
    return () => subscription.remove();
  }, []);

  if (!visible) return null;
  return (
    <View
      style={styles.overlay}
      className="bg-surface0 items-center justify-center"
      accessibilityLabel="App content hidden"
    >
      <Text className="text-text-hi text-text20 font-medium">DevinX</Text>
      <Text className="text-text-low text-text13 mt-2">Unlock the app to continue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
