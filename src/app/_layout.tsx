/**
 * Root layout — wires ThemeProvider, TanStack Query, Sentry, and the
 * SafeAreaProvider. Expo Router file-based routing lives under /src/app.
 */

import '../../global.css';
import { Stack, Redirect, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@theme/index';
import { initSentry } from '@lib/sentry';
import { AuthProvider, useAuth } from '@auth/AuthContext';

initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof Error && /401|auth/i.test(error.message)) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

/** Initial route — declarative redirect based on auth state. */
function InitialRoute() {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();
  const inOnboarding = segments[0] === '(onboarding)';

  if (!isAuthenticated && !inOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }
  if (isAuthenticated && inOnboarding) {
    return <Redirect href="/(main)" />;
  }
  return null;
}

function ThemedStack() {
  const { name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: name === 'dark' ? '#141414' : '#FCFCFC' },
        }}
      >
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(main)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <InitialRoute />
            <ThemedStack />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
