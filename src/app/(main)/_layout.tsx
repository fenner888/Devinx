import { Stack } from 'expo-router';

export default function MainGroup() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="compose" />
      <Stack.Screen name="usage" />
      <Stack.Screen name="automations" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="knowledge" />
      <Stack.Screen name="playbooks" />
      <Stack.Screen name="secrets" />
      <Stack.Screen name="review" />
      <Stack.Screen name="security" />
      <Stack.Screen name="settings/index" />
    </Stack>
  );
}
