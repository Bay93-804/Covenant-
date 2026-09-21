import { Stack } from 'expo-router';

import { color, semanticColor } from '../../../src/design-system/tokens';

/**
 * Without this layout, Expo Router treats every file directly under
 * `(tabs)/profile/` (delete-account, reset-demo-data) as its own sibling tab
 * of the parent `Tabs` navigator in `(tabs)/_layout.tsx` instead of a pushed
 * screen within the Profile tab — see mobile/README.md's "Expo Router
 * pitfall" section, and `e2e/routing.spec.ts`'s five-tabs regression guard.
 */
export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.navy[900] },
        headerTintColor: semanticColor.accentPrimary,
        headerTitleStyle: { color: semanticColor.textPrimary },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
    </Stack>
  );
}
