/**
 * Onboarding layout — stack with three steps: welcome → credentials → validate.
 */
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="credentials" />
      <Stack.Screen name="validate" />
    </Stack>
  );
}
