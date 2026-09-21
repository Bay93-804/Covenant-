import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  AppText,
  Badge,
  BarTrendChart,
  Button,
  Card,
  Divider,
  LineTrendChart,
  Screen,
} from '../../../src/design-system';
import type { BarTrendPoint } from '../../../src/design-system';
import { useEnrollmentSchedule } from '../../../src/features/program/useEnrollmentSchedule';
import {
  useExerciseHistory,
  useProgramAdherence,
  useReadinessAndAdjustments,
} from '../../../src/features/progress/useProgress';
import { useTestingComparison } from '../../../src/features/testing/useTesting';
import { tierLabel } from '../../../src/features/testing/markerFormats';

function AdherenceSection() {
  const { data, isLoading } = useProgramAdherence();
  if (isLoading || !data) return <ActivityIndicator style={{ marginVertical: 20 }} />;

  const bars: BarTrendPoint[] = data.weeks.map((w) => ({
    label: `${w.weekNumber}`,
    value: w.hasStarted ? Math.round(w.completionPct) : null,
    sublabel: w.hasStarted
      ? `${w.completedCount + w.adjustedCount}/${w.scheduledSessionCount}`
      : undefined,
    emphasis: !w.hasStarted
      ? 'neutral'
      : w.completionPct >= 90
        ? 'good'
        : w.completionPct < 50 && w.hasFullyElapsed
          ? 'bad'
          : 'default',
  }));

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
        PROGRAM PROGRESS
      </AppText>
      <AppText variant="h3" color="primary" style={{ marginBottom: 4 }}>
        Week {data.currentWeek}
        {data.currentBlock ? ` · ${data.currentBlock}` : ''}
      </AppText>
      <AppText variant="bodySm" color="secondary" style={{ marginBottom: 16 }}>
        {data.totalCompleted + data.totalAdjusted} of {data.totalScheduled} sessions logged so far ·{' '}
        {Math.round(data.overallAdherencePct)}% adherence
      </AppText>
      <BarTrendChart
        title="Weekly completion percentage"
        points={bars}
        valueSuffix="%"
        domainMax={100}
      />
      <View className="flex-row justify-between mt-4">
        <View>
          <AppText variant="h3" color="primary">
            {data.totalCompleted}
          </AppText>
          <AppText variant="caption" color="muted">
            Completed
          </AppText>
        </View>
        <View>
          <AppText variant="h3" color="primary">
            {data.totalAdjusted}
          </AppText>
          <AppText variant="caption" color="muted">
            Adjusted
          </AppText>
        </View>
        <View>
          <AppText variant="h3" color="primary">
            {data.totalMissed}
          </AppText>
          <AppText variant="caption" color="muted">
            Missed
          </AppText>
        </View>
      </View>
    </Card>
  );
}

function TestingSection() {
  const { data, isLoading } = useTestingComparison();
  if (isLoading || !data) return null;

  const notable = data
    .filter(
      (c) =>
        c.changeToWeek12 || c.changeToWeek12Left || c.changeToWeek12Right || c.week0?.isDeferred,
    )
    .slice(0, 3);
  const anyResults = data.some((c) => c.week0?.hasResult || c.week12?.hasResult);

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
        TESTING PROGRESS
      </AppText>
      <AppText variant="h3" color="primary" style={{ marginBottom: 10 }}>
        Week 0 vs Week 12
      </AppText>
      {!anyResults ? (
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
          Complete Week 0 baseline testing in the Testing tab to start tracking this.
        </AppText>
      ) : (
        notable.map((c) => {
          const change = c.changeToWeek12;
          if (change) {
            return (
              <View key={c.markerNumber} className="flex-row items-center justify-between mb-2">
                <AppText variant="bodySm" color="primary">
                  #{c.markerNumber} {c.marker.name}
                </AppText>
                <Badge
                  label={
                    change.direction === 'improved'
                      ? 'Improved'
                      : change.direction === 'declined'
                        ? 'Declined'
                        : 'Unchanged'
                  }
                  tone={
                    change.direction === 'improved'
                      ? 'success'
                      : change.direction === 'declined'
                        ? 'danger'
                        : 'neutral'
                  }
                />
              </View>
            );
          }
          if (c.changeToWeek12Left || c.changeToWeek12Right) {
            return (
              <View key={c.markerNumber} className="mb-2">
                <AppText variant="bodySm" color="primary" style={{ marginBottom: 2 }}>
                  #{c.markerNumber} {c.marker.name} (no combined score — per side)
                </AppText>
                <View className="flex-row gap-2">
                  {c.changeToWeek12Left ? (
                    <Badge
                      label={`L: ${c.changeToWeek12Left.direction}`}
                      tone={
                        c.changeToWeek12Left.direction === 'improved'
                          ? 'success'
                          : c.changeToWeek12Left.direction === 'declined'
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  ) : null}
                  {c.changeToWeek12Right ? (
                    <Badge
                      label={`R: ${c.changeToWeek12Right.direction}`}
                      tone={
                        c.changeToWeek12Right.direction === 'improved'
                          ? 'success'
                          : c.changeToWeek12Right.direction === 'declined'
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  ) : null}
                </View>
              </View>
            );
          }
          return (
            <View key={c.markerNumber} className="flex-row items-center justify-between mb-2">
              <AppText variant="bodySm" color="primary">
                #{c.markerNumber} {c.marker.name}
              </AppText>
              <Badge label="Deferred → Wk 6" tone="gold" />
            </View>
          );
        })
      )}
      <Button variant="secondary" onPress={() => router.push('/(tabs)/testing/compare')}>
        Full testing comparison
      </Button>
    </Card>
  );
}

function ExerciseSection() {
  const { data, isLoading } = useExerciseHistory();
  if (isLoading || !data) return <ActivityIndicator style={{ marginVertical: 20 }} />;

  if (data.length === 0) {
    return (
      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
          EXERCISE PROGRESS
        </AppText>
        <AppText variant="bodySm" color="secondary">
          Complete strength or core/balance/brake sessions to build exercise history here.
        </AppText>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
        EXERCISE PROGRESS
      </AppText>
      <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
        {data.length} exercises logged
      </AppText>
      {data.slice(0, 5).map((entry) => (
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
          <View className="flex-row items-center justify-between py-2" style={{ minHeight: 44 }}>
            <AppText variant="body" color="primary">
              {entry.name}
            </AppText>
            {entry.bestWeight ? (
              <Badge
                label={`Best: ${entry.bestWeight.value} ${entry.bestWeight.unit}`}
                tone="gold"
              />
            ) : entry.bestReps ? (
              <Badge label={`Best: ${entry.bestReps.value} reps`} tone="gold" />
            ) : null}
          </View>
        </Pressable>
      ))}
      {data.length > 5 ? (
        <Button variant="ghost" onPress={() => router.push('/(tabs)/progress/exercise')}>
          View all {data.length} exercises
        </Button>
      ) : null}
    </Card>
  );
}

function ReadinessSection() {
  const { data, isLoading } = useReadinessAndAdjustments();
  if (isLoading || !data) return <ActivityIndicator style={{ marginVertical: 20 }} />;

  const rhrPoints = data.trend
    .filter((p) => p.restingHr != null)
    .slice(-12)
    .map((p) => ({ label: p.date.slice(5), value: p.restingHr }));
  const sleepPoints = data.trend
    .filter((p) => p.sleepHours != null)
    .slice(-12)
    .map((p) => ({ label: p.date.slice(5), value: p.sleepHours }));

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
        READINESS &amp; ADJUSTMENTS
      </AppText>
      <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
        {data.totalReadinessChecks} readiness checks logged. This is training data, not a medical
        record — never a diagnosis.
      </AppText>

      {rhrPoints.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 6 }}>
            Resting heart rate trend
          </AppText>
          <LineTrendChart title="Resting heart rate" points={rhrPoints} valueSuffix=" bpm" />
        </View>
      ) : null}

      {sleepPoints.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 6 }}>
            Sleep trend
          </AppText>
          <LineTrendChart title="Sleep hours" points={sleepPoints} valueSuffix="h" />
        </View>
      ) : null}

      {data.safetyFlags.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 6 }}>
            Safety flags
          </AppText>
          {data.safetyFlags.map((f) => (
            <AppText
              key={f.triggerCode}
              variant="bodySm"
              color="secondary"
              style={{ marginBottom: 2 }}
            >
              {f.triggerCode.replace(/_/g, ' ').toLowerCase()} · {f.count}× · last{' '}
              {f.lastOccurred.slice(0, 10)}
            </AppText>
          ))}
        </View>
      ) : null}

      {data.pickupSport.totalSessions > 0 ? (
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
          Pickup sport: {data.pickupSport.totalSessions} session
          {data.pickupSport.totalSessions === 1 ? '' : 's'} logged, last on{' '}
          {data.pickupSport.lastPlayedOn}.
        </AppText>
      ) : null}

      <Button variant="secondary" onPress={() => router.push('/(tabs)/progress/readiness-history')}>
        Full readiness history
      </Button>
    </Card>
  );
}

export default function ProgressScreen() {
  const { data: scheduleContext, isLoading } = useEnrollmentSchedule();

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (!scheduleContext) {
    return (
      <Screen>
        <AppText variant="h2" color="primary" style={{ marginTop: 24 }}>
          Progress
        </AppText>
        <AppText variant="body" color="secondary" style={{ marginTop: 12 }}>
          Your progress dashboard fills in once you&apos;ve started the program.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 4 }}>
        Progress
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        What actually happened — nothing projected, nothing shamed.
      </AppText>

      <AdherenceSection />
      <TestingSection />
      <ExerciseSection />
      <ReadinessSection />

      <Divider className="my-2" />
      <AppText variant="caption" color="muted" style={{ marginTop: 8, marginBottom: 20 }}>
        {tierLabel(null)} results simply mean not enough data to classify yet — never a fabricated
        standard.
      </AppText>
    </Screen>
  );
}
