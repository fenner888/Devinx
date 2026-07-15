/**
 * Root layout — wires ThemeProvider, TanStack Query, and the
 * SafeAreaProvider. Expo Router file-based routing lives under /src/app.
 */

import '../../global.css';
import { AppState, Platform } from 'react-native';
import { Stack, Redirect, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider, useTheme, loadThemePreference } from '@theme/index';
import { shouldRetryQuery } from '@api/devin/client';
import { AuthProvider } from '@auth/AuthContext';
import { ConnectionProvider, useConnections } from '@auth/ConnectionContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { PrivacyShield } from '@components/PrivacyShield';

loadThemePreference();

// TanStack Query has no built-in focus/online detection on React Native —
// without these, refetchOnWindowFocus/refetchOnReconnect are no-ops and
// polling that stops in the background never restarts on foreground.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The API client already retries transient failures internally —
      // shouldRetryQuery adds at most ONE query-layer attempt and never
      // retries deterministic failures (auth/permission/404/schema).
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

/** Initial route — declarative redirect based on auth state. */
function InitialRoute() {
  const { isConfigured, isLoading } = useConnections();
  const segments = useSegments();

  const inOnboarding = segments[0] === '(onboarding)';

  // Wait for the Keychain check before redirecting — otherwise every
  // authenticated cold start flashes the onboarding screen.
  if (isLoading) return null;

  if (!isConfigured && !inOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }
  if (isConfigured && inOnboarding) {
    return <Redirect href="/(main)" />;
  }
  return null;
}

function ThemedStack() {
  const { name, tokens } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.surface0.hex },
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
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <ConnectionProvider>
                <InitialRoute />
                <ThemedStack />
                <PrivacyShield />
              </ConnectionProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
