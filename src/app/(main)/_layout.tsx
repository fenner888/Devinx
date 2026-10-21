import { Stack } from 'expo-router';

export default function MainGroup() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sessions" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="computer" />
      <Stack.Screen name="computer-session/[bridgeId]/[id]" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
