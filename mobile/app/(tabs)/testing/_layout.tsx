import { Stack } from 'expo-router';

import { color, semanticColor } from '../../../src/design-system/tokens';

/** See app/(tabs)/today/_layout.tsx for why this Stack (and its header behavior) is required. */
export default function TestingLayout() {
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
    </Stack>
  );
}
