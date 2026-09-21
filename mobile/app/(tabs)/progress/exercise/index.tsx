import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../../src/design-system';
import { useExerciseHistory } from '../../../../src/features/progress/useProgress';

export default function ExerciseHistoryListScreen() {
  const { data, isLoading } = useExerciseHistory();

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 6 }}>
        Exercise history
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        {data.length} exercises logged across your training.
      </AppText>

      {data.map((entry) => (
        <Pressable
          key={entry.name}
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/progress/exercise/[name]',
              params: { name: entry.name },
            })
          }
        >
          <Card className="mb-3">
            <View className="flex-row items-center justify-between mb-1">
              <AppText variant="body" color="primary">
                {entry.name}
              </AppText>
              <AppText variant="caption" color="muted">
                {entry.totalSetsLogged} sets
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-2 mt-1">
              {entry.bestWeight ? (
                <Badge label={`${entry.bestWeight.value} ${entry.bestWeight.unit}`} tone="gold" />
              ) : null}
              {entry.bestReps ? (
                <Badge label={`${entry.bestReps.value} reps`} tone="neutral" />
              ) : null}
              {entry.bestHoldSeconds ? (
                <Badge label={`${entry.bestHoldSeconds.value}s hold`} tone="neutral" />
              ) : null}
              {entry.bestDistance ? (
                <Badge
                  label={`${entry.bestDistance.value} ${entry.bestDistance.unit}`}
                  tone="neutral"
                />
              ) : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
