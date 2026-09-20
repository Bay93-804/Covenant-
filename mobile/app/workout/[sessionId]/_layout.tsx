import { Stack } from 'expo-router';

export default function WorkoutSessionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1220' } }}>
      <Stack.Screen name="overview" />
      <Stack.Screen name="player" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
