import { Stack } from 'expo-router';

import { OnboardingProvider } from '../../src/features/onboarding/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1220' } }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="medical-clearance" />
        <Stack.Screen name="program-start-date" />
        <Stack.Screen name="week0-testing-intro" />
        <Stack.Screen name="starting-maxes" />
        <Stack.Screen name="notification-setup" />
      </Stack>
    </OnboardingProvider>
  );
}
