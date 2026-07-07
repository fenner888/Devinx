/**
 * Root layout — wires ThemeProvider, TanStack Query, Sentry, and the
 * SafeAreaProvider. Expo Router file-based routing lives under /src/app.
 */

// @ts-expect-error — side-effect CSS import (NativeWind)
import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
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
        // Spec §8.4: 401 → hard stop; 5xx/network → 3 retries with backoff.
        if (error instanceof Error && /401|auth/i.test(error.message)) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

/** Route guard — redirects to onboarding if not authenticated. */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inOnboarding = segments[0] === '(onboarding)';
    if (!isAuthenticated && !inOnboarding) {
      router.replace('/(onboarding)');
    } else if (isAuthenticated && inOnboarding) {
      router.replace('/(main)');
    }
  }, [isAuthenticated, segments, router]);

  return <>{children}</>;
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
            <RouteGuard>
              <ThemedStack />
            </RouteGuard>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
