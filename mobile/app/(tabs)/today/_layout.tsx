import { Stack } from 'expo-router';

import { color, semanticColor } from '../../../src/design-system/tokens';

/**
 * Without this layout, Expo Router treats every file directly under
 * `(tabs)/today/` (readiness-check, safety-adjustment) as its own sibling
 * tab of the parent `Tabs` navigator in `(tabs)/_layout.tsx`, instead of a
 * pushed screen within the Today tab — this Stack keeps them nested. The
 * tab's own `index` route hides the header (it renders its own title);
 * every pushed screen keeps the native header so there's a visible way back
 * beyond browser/gesture navigation.
 */
export default function TodayLayout() {
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
