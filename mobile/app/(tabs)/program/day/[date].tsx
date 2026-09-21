import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Button, Card, Screen } from '../../../../src/design-system';
import {
  useProgramCalendar,
  type DayCalendarEntry,
  type DayCalendarState,
} from '../../../../src/features/program/useProgramCalendar';
import { useEnrollmentSchedule } from '../../../../src/features/program/useEnrollmentSchedule';
import type { ScheduledSession } from '../../../../src/features/schedule/scheduleEngine';
import type { WorkoutSession } from '../../../../src/features/workout/types';

function SlotSection({
  slotLabel,
  session,
  workoutSession,
  adjusted,
  isToday,
  isFuture,
}: {
  slotLabel: string;
  session: ScheduledSession;
  workoutSession: WorkoutSession | null;
  adjusted: boolean;
  isToday: boolean;
  isFuture: boolean;
}) {
  if (session.isRestDay) {
    return (
      <Card className="mb-4">
        <Badge label={slotLabel} tone="neutral" />
        <AppText variant="h3" color="primary" style={{ marginTop: 8 }}>
          {session.title}
        </AppText>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Badge label={slotLabel} tone="gold" />
        <View className="flex-row items-center gap-2">
          {workoutSession ? (
            <Badge
              label={workoutSession.status.replace('_', ' ')}
              tone={workoutSession.status === 'completed' ? 'success' : 'neutral'}
            />
          ) : null}
          {adjusted ? <Badge label="Adjusted" tone="gold" /> : null}
        </View>
      </View>
      <AppText variant="h3" color="primary" style={{ marginBottom: 12 }}>
        {session.title}
      </AppText>

      {workoutSession?.status === 'completed' ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/workout/[sessionId]/summary',
              params: { sessionId: workoutSession.id, mode: 'review' },
            })
          }
        >
          Review session
        </Button>
      ) : isFuture ? (
        <AppText variant="bodySm" color="muted">
          Scheduled — not available to start yet.
        </AppText>
      ) : isToday ? (
        <Button onPress={() => router.push('/(tabs)/today')}>Go to Today</Button>
      ) : workoutSession?.status === 'in_progress' ? (
        <Button
          onPress={() =>
            router.push({
              pathname: '/workout/[sessionId]/player',
              params: { sessionId: workoutSession.id },
            })
          }
        >
          Resume session
        </Button>
      ) : (
        <AppText variant="bodySm" color="muted">
          No session was logged for this day. Past days can&apos;t be started retroactively —
          history is preserved as-is.
        </AppText>
      )}
    </Card>
  );
}

function findDay(
  weeks: ReturnType<typeof useProgramCalendar>['data'],
  date: string,
): DayCalendarEntry | null {
  if (!weeks) return null;
  for (const week of weeks) {
    const found = week.days.find((d) => d.scheduledDay.date === date);
    if (found) return found;
  }
  return null;
}

export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: weeks, isLoading } = useProgramCalendar();
  const { data: scheduleContext } = useEnrollmentSchedule();

  if (isLoading || !weeks || !scheduleContext) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const day = findDay(weeks, date!);
  if (!day) {
    return (
      <Screen>
        <AppText variant="body" color="secondary" style={{ marginTop: 40 }}>
          Day not found.
        </AppText>
      </Screen>
    );
  }

  const isToday = date === scheduleContext.todayIso;
  const isFuture = date! > scheduleContext.todayIso;
  const stateLabel = (s: DayCalendarState) => s.replace('_', ' ');

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        WEEK {day.scheduledDay.weekNumber} · {day.scheduledDay.dayLabel}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 20 }}>
        {day.scheduledDay.date}
      </AppText>

      <SlotSection
        slotLabel={`AM · ${stateLabel(day.amState)}`}
        session={day.scheduledDay.am}
        workoutSession={day.amSession}
        adjusted={day.amAdjusted}
        isToday={isToday}
        isFuture={isFuture}
      />
      <SlotSection
        slotLabel={`PM · ${stateLabel(day.pmState)}`}
        session={day.scheduledDay.pm}
        workoutSession={day.pmSession}
        adjusted={day.pmAdjusted}
        isToday={isToday}
        isFuture={isFuture}
      />
    </Screen>
  );
}
