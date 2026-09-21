import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  AppText,
  Badge,
  Card,
  Divider,
  LineTrendChart,
  Screen,
} from '../../../../src/design-system';
import { useExerciseHistory } from '../../../../src/features/progress/useProgress';

function formatSetValue(record: {
  weight: number | null;
  weightUnit: string | null;
  reps: number | null;
  timeSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  sprintTime: number | null;
  side: string | null;
}): string {
  const parts: string[] = [];
  if (record.weight != null) parts.push(`${record.weight} ${record.weightUnit ?? ''}`.trim());
  if (record.reps != null) parts.push(`${record.reps} reps`);
  if (record.timeSeconds != null) parts.push(`${record.timeSeconds}s`);
  if (record.distance != null) parts.push(`${record.distance} ${record.distanceUnit ?? ''}`.trim());
  if (record.sprintTime != null) parts.push(`${record.sprintTime}s sprint`);
  if (record.side) parts.push(record.side);
  return parts.length > 0 ? parts.join(' · ') : 'Logged';
}

export default function ExerciseDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, isLoading } = useExerciseHistory();

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const entry = data.find((e) => e.name === name);
  if (!entry) {
    return (
      <Screen>
        <AppText variant="body" color="secondary" style={{ marginTop: 40 }}>
          No history for &quot;{name}&quot; yet.
        </AppText>
      </Screen>
    );
  }

  const volumePoints = entry.volumeBySession
    .filter((v) => v.totalVolume != null)
    .map((v) => ({ label: `Wk ${v.weekNumber}`, value: v.totalVolume }));

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 6 }}>
        {entry.name}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        {entry.totalSetsLogged} sets logged, {entry.firstLoggedDate} to {entry.lastLoggedDate}.
      </AppText>

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          PERSONAL BESTS
        </AppText>
        <View className="flex-row flex-wrap gap-2">
          {entry.bestWeight ? (
            <Badge
              label={`${entry.bestWeight.value} ${entry.bestWeight.unit} (Wk ${entry.bestWeight.weekNumber})`}
              tone="gold"
            />
          ) : null}
          {entry.bestReps ? (
            <Badge
              label={`${entry.bestReps.value} reps (Wk ${entry.bestReps.weekNumber})`}
              tone="gold"
            />
          ) : null}
          {entry.bestHoldSeconds ? (
            <Badge
              label={`${entry.bestHoldSeconds.value}s hold (Wk ${entry.bestHoldSeconds.weekNumber})`}
              tone="gold"
            />
          ) : null}
          {entry.bestDistance ? (
            <Badge
              label={`${entry.bestDistance.value} ${entry.bestDistance.unit} (Wk ${entry.bestDistance.weekNumber})`}
              tone="gold"
            />
          ) : null}
          {entry.bestSprintTime ? (
            <Badge
              label={`${entry.bestSprintTime.value}s fastest (Wk ${entry.bestSprintTime.weekNumber})`}
              tone="gold"
            />
          ) : null}
          {!entry.bestWeight &&
          !entry.bestReps &&
          !entry.bestHoldSeconds &&
          !entry.bestDistance &&
          !entry.bestSprintTime ? (
            <AppText variant="bodySm" color="muted">
              Not enough comparable data yet.
            </AppText>
          ) : null}
        </View>
      </Card>

      {volumePoints.length > 1 ? (
        <Card className="mb-4">
          <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
            VOLUME TREND (WEIGHT × REPS, SESSIONS WITH BOTH LOGGED)
          </AppText>
          <LineTrendChart title="Volume" points={volumePoints} />
        </Card>
      ) : null}

      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        SET HISTORY
      </AppText>
      {[...entry.records].reverse().map((r, i) => (
        <View key={i}>
          <View className="flex-row items-center justify-between py-2" style={{ minHeight: 40 }}>
            <AppText variant="bodySm" color="secondary">
              Wk {r.weekNumber} · {r.scheduledDate} · Set {r.setNumber}
            </AppText>
            <AppText variant="bodySm" color="primary">
              {formatSetValue(r)}
            </AppText>
          </View>
          <Divider />
        </View>
      ))}
    </Screen>
  );
}
