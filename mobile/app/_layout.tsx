import '../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText, Screen } from '../src/design-system';
import { AuthProvider, useAuth } from '../src/lib/auth/AuthContext';
import { useAuthDeepLink } from '../src/lib/auth/authDeepLink';
import { ErrorBoundary } from '../src/lib/ErrorBoundary';
import { isMisconfiguredProductionBuild } from '../src/lib/env';
import { installGlobalErrorHandlers } from '../src/lib/globalErrorHandlers';

installGlobalErrorHandlers();

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op: fails harmlessly if already hidden (e.g. fast refresh)
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

function RootNavigator() {
  const { isLoading } = useAuth();
  useAuthDeepLink();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1220' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="workout/[sessionId]" />
    </Stack>
  );
}

/**
 * A production (TestFlight/App Store) binary must never silently run in
 * local demo mode just because its backend configuration didn't make it
 * into the build — that would let a real athlete believe their data is
 * syncing to the cloud when it's only ever on this one device. This is
 * checked once, before AuthProvider (and therefore before either backend
 * path) ever mounts.
 */
function MisconfiguredProductionScreen() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <AppText variant="h2" color="primary" center>
          Configuration error
        </AppText>
        <AppText variant="body" color="secondary" center>
          This build is missing its backend configuration and cannot start. This is a build problem,
          not something fixable on-device — please contact support or reinstall from TestFlight once
          a corrected build is available.
        </AppText>
      </View>
    </Screen>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          {isMisconfiguredProductionBuild ? (
            <MisconfiguredProductionScreen />
          ) : (
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <StatusBar style="light" />
                <RootNavigator />
              </AuthProvider>
            </QueryClientProvider>
          )}
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
