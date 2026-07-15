/**
 * Onboarding layout — welcome → connection choice → provider-specific setup.
 */
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="features" />
      <Stack.Screen name="connections" />
      <Stack.Screen name="credentials" />
      <Stack.Screen name="validate" />
      <Stack.Screen name="computer" />
    </Stack>
  );
}
