import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../src/design-system';
import { semanticColor } from '../../../src/design-system/tokens';
import { formatLongDate } from '../../../src/features/program/monthCalendar';
import { usePastRuns } from '../../../src/features/progress/usePastRuns';

/** Archived program runs and their completed workouts (read-only history). */
export default function PastRunsScreen() {
  const { data: runs, isLoading } = usePastRuns();

  if (isLoading || !runs) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="body" color="secondary" style={{ marginTop: 16, marginBottom: 16 }}>
        Runs you restarted or ended. Everything you logged in them is kept here exactly as it was.
      </AppText>

      {runs.length === 0 ? (
        <Card>
          <AppText variant="body" color="secondary">
            No past runs yet.
          </AppText>
        </Card>
      ) : null}

      {runs.map(({ enrollment, completedWorkouts, completedTestingEvents }) => (
        <Card key={enrollment.id} className="mb-4">
          <View className="flex-row items-center justify-between mb-1" style={{ gap: 8 }}>
            <AppText variant="h3" color="primary" style={{ flexShrink: 1 }}>
              Started {formatLongDate(enrollment.startDate, true)}
            </AppText>
            <Badge
              label={enrollment.status === 'restarted' ? 'Restarted' : 'Archived'}
              tone="neutral"
            />
          </View>
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
            {completedWorkouts.length} workouts completed · {completedTestingEvents} testing events
            completed
            {enrollment.archivedAt
              ? ` · archived ${formatLongDate(enrollment.archivedAt.slice(0, 10), true)}`
              : ''}
          </AppText>
          {completedWorkouts.map((w) => (
            <Pressable
              key={w.sessionId}
              accessibilityRole="button"
              accessibilityLabel={`Review ${w.title}, week ${w.weekNumber}, ${formatLongDate(w.date, true)}`}
              onPress={() =>
                router.push({
                  pathname: '/workout/[sessionId]/summary',
                  params: { sessionId: w.sessionId, mode: 'review' },
                })
              }
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: semanticColor.borderSubtle,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View className="flex-row items-center justify-between">
                <View style={{ flexShrink: 1 }}>
                  <AppText variant="body" color="primary">
                    {w.title}
                  </AppText>
                  <AppText variant="caption" color="muted">
                    Week {w.weekNumber} · {w.slot.toUpperCase()} · {formatLongDate(w.date)}
                  </AppText>
                </View>
                <AppText variant="button" color="accent">
                  ›
                </AppText>
              </View>
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
