/**
 * Onboarding layout — welcome → features → Mac pairing.
 */
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="features" />
      <Stack.Screen name="computer" />
    </Stack>
  );
}
