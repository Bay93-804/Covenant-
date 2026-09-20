import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { getTestingEvent } from '../../../src/content';
import { computeTodayContext } from '../../../src/features/today/computeTodayContext';
import { useEnrollmentStatus } from '../../../src/lib/onboarding/useEnrollmentStatus';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import {
  useEnrollmentSchedule,
  useInvalidateEnrollmentSchedule,
} from '../../../src/features/program/useEnrollmentSchedule';
import {
  useInvalidateTodaySessions,
  useTodaySessions,
} from '../../../src/features/program/useTodaySessions';
import { restartEnrollmentAtBlockStart } from '../../../src/lib/enrollment/enrollmentService';
import { generateId, getOrCreateSession } from '../../../src/features/workout/workoutRepository';
import {
  dateForWeekStart,
  type ScheduledSession,
} from '../../../src/features/schedule/scheduleEngine';
import type { WorkoutSession } from '../../../src/features/workout/types';

function Week0Checklist({ week1StartDate }: { week1StartDate: string }) {
  const week0 = getTestingEvent('week0');

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        WEEK 0 · BASELINE TESTING CHECKLIST
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 12 }}>
        Starts now
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        Week 1 begins {week1StartDate}. Everything below happens before then — head to the Testing
        tab to log results as you complete each item.
      </AppText>

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          REQUIRED BEFORE WEEK 1
        </AppText>
        <AppText variant="bodySm" color="primary" style={{ marginBottom: 10 }}>
          • {week0.schedulingRules.restingHeartRate}
        </AppText>
        <AppText variant="bodySm" color="primary" style={{ marginBottom: 10 }}>
          • {week0.schedulingRules.athleticFive}
        </AppText>
        <AppText variant="bodySm" color="primary">
          • The remaining baseline markers ({week0.markers.length} total across all three
          Longevity/Athletic Five categories).
        </AppText>
      </Card>

      <Card>
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          SUGGESTED SCHEDULE (FLEXIBLE)
        </AppText>
        {week0.suggestedSchedule.days.map((day, i) => (
          <AppText key={i} variant="bodySm" color="primary" style={{ marginBottom: 6 }}>
            • {day.suggestedDay ? `${day.suggestedDay}: ` : ''}
            {day.what}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}

function statusLabel(status: WorkoutSession['status'] | null): {
  label: string;
  tone: 'gold' | 'neutral' | 'success' | 'danger';
} {
  switch (status) {
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'in_progress':
      return { label: 'In progress', tone: 'gold' };
    case 'skipped':
      return { label: 'Skipped', tone: 'danger' };
    case 'adjusted':
      return { label: 'Adjusted', tone: 'gold' };
    default:
      return { label: 'Not started', tone: 'neutral' };
  }
}

function SessionCard({
  slotLabel,
  session,
  workoutSession,
  onAction,
  actionLabel,
  actionLoading,
}: {
  slotLabel: string;
  session: ScheduledSession;
  workoutSession: WorkoutSession | null;
  onAction: (() => void) | null;
  actionLabel: string;
  actionLoading: boolean;
}) {
  if (session.isRestDay) {
    return (
      <Card className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Badge label={slotLabel} tone="neutral" />
        </View>
        <AppText variant="h3" color="primary">
          {session.title}
        </AppText>
      </Card>
    );
  }

  const status = statusLabel(workoutSession?.status ?? null);

  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Badge label={slotLabel} tone="gold" />
        <View className="flex-row items-center gap-2">
          {session.requiresReadinessCheck ? <Badge label="Readiness gate" tone="neutral" /> : null}
          {session.minutesLow ? (
            <AppText variant="caption" color="muted">
              {session.minutesLow}
              {session.minutesHigh && session.minutesHigh !== session.minutesLow
                ? `–${session.minutesHigh}`
                : ''}{' '}
              MIN
            </AppText>
          ) : null}
        </View>
      </View>
      <AppText variant="h3" color="primary" style={{ marginBottom: 10 }}>
        {session.title}
      </AppText>
      <View className="flex-row items-center justify-between mb-3">
        <Badge label={status.label} tone={status.tone} />
        {workoutSession?.completion_pct != null ? (
          <AppText variant="caption" color="muted">
            {Math.round(workoutSession.completion_pct)}% complete
          </AppText>
        ) : null}
      </View>
      {onAction ? (
        <Button
          variant={workoutSession?.status === 'completed' ? 'secondary' : 'primary'}
          onPress={onAction}
          loading={actionLoading}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { data: enrollment } = useEnrollmentStatus();
  const { data: scheduleContext, isLoading: scheduleLoading } = useEnrollmentSchedule();
  const invalidateSchedule = useInvalidateEnrollmentSchedule();
  const invalidateToday = useInvalidateTodaySessions();
  const [pendingAction, setPendingAction] = useState<'am' | 'pm' | null>(null);
  const [restarting, setRestarting] = useState(false);

  const { data: todayData, isLoading: todayLoading } = useTodaySessions(
    scheduleContext?.enrollmentId,
    scheduleContext?.scheduleInput,
    scheduleContext?.todayIso,
  );

  if (!enrollment?.startDate) {
    return (
      <Screen>
        <AppText variant="h2" color="primary" style={{ marginTop: 24 }}>
          Today
        </AppText>
      </Screen>
    );
  }

  const context = computeTodayContext(enrollment.startDate);

  if (context.isBeforeProgramStart) {
    return <Week0Checklist week1StartDate={enrollment.startDate} />;
  }

  if (context.isProgramComplete) {
    return (
      <Screen>
        <AppText variant="h1" color="primary" style={{ marginTop: 24 }} center>
          12 weeks, done.
        </AppText>
        <AppText variant="body" color="secondary" center style={{ marginTop: 12 }}>
          Head to Testing for your Week 12 comparison, and Profile to plan what&apos;s next.
        </AppText>
      </Screen>
    );
  }

  if (scheduleLoading || todayLoading || !todayData || !scheduleContext) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const {
    scheduledDay,
    amWorkoutSession,
    pmWorkoutSession,
    readinessEntry,
    readinessEvaluation,
    missedWeeks,
  } = todayData;
  const blockName = scheduledDay.weekContext.block?.name ?? '';

  async function handleSessionAction(slot: 'am' | 'pm') {
    const session = slot === 'am' ? scheduledDay.am : scheduledDay.pm;
    const workoutSession = slot === 'am' ? amWorkoutSession : pmWorkoutSession;

    if (workoutSession?.status === 'completed') {
      router.push({
        pathname: '/workout/[sessionId]/summary',
        params: { sessionId: workoutSession.id, mode: 'review' },
      });
      return;
    }

    if (session.requiresReadinessCheck) {
      if (!readinessEntry) {
        router.push({
          pathname: '/(tabs)/today/readiness-check',
          params: { date: scheduledDay.date, slot },
        });
        return;
      }
      if (readinessEvaluation?.requiresConfirmation) {
        router.push({
          pathname: '/(tabs)/today/safety-adjustment',
          params: { date: scheduledDay.date, slot },
        });
        return;
      }
    }

    setPendingAction(slot);
    try {
      const created = await getOrCreateSession({
        id: workoutSession?.id ?? generateId(),
        enrollmentId: scheduleContext!.enrollmentId,
        userId: user!.id,
        scheduledDate: scheduledDay.date,
        sessionSlot: slot,
        sessionType: session.sessionType,
        weekNumber: scheduledDay.weekNumber,
        dayOfWeek: scheduledDay.dayOfWeek,
        strengthLetter: session.strengthLetter,
      });
      invalidateToday();
      router.push({
        pathname: '/workout/[sessionId]/overview',
        params: { sessionId: created.id, date: scheduledDay.date, slot },
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRestartAtBlockStart() {
    if (!missedWeeks.restartBlockStartWeek) return;
    setRestarting(true);
    try {
      const anchorDate = dateForWeekStart(
        scheduleContext!.scheduleInput,
        missedWeeks.restartBlockStartWeek,
      );
      await restartEnrollmentAtBlockStart(
        user!.id,
        scheduleContext!.enrollmentId,
        missedWeeks.restartBlockStartWeek,
        anchorDate,
      );
      invalidateSchedule();
      invalidateToday();
    } finally {
      setRestarting(false);
    }
  }

  const showTestingBanner =
    scheduledDay.weekContext.isRetest || scheduledDay.weekContext.isTaperAndTest;

  return (
    <Screen scroll>
      <View className="mt-4 mb-6">
        <AppText variant="overline" color="accent">
          {scheduledDay.date} · WEEK {scheduledDay.weekNumber}
          {blockName ? ` · ${blockName}` : ''}
        </AppText>
        <View className="flex-row items-center gap-2 mt-1 flex-wrap">
          <AppText variant="h1" color="primary">
            {scheduledDay.dayLabel}
          </AppText>
          {scheduledDay.weekContext.isDeload ? <Badge label="Deload" tone="neutral" /> : null}
          {scheduledDay.weekContext.isRetest ? <Badge label="Retest" tone="gold" /> : null}
          {scheduledDay.weekContext.isTaperAndTest ? <Badge label="Test Week" tone="gold" /> : null}
          {scheduleContext.status === 'paused' ? <Badge label="Paused" tone="danger" /> : null}
        </View>
      </View>

      {missedWeeks.shouldRecommendRestart ? (
        <Card className="mb-4" emphasized>
          <Badge label="Two missed weeks" tone="danger" />
          <AppText variant="h3" color="primary" style={{ marginTop: 10, marginBottom: 6 }}>
            Restart at the beginning of the block you were in
          </AppText>
          <AppText variant="body" color="secondary" style={{ marginBottom: 12 }}>
            Missed weeks: {missedWeeks.missedWeekNumbers.join(', ')}. Per the program&apos;s rule,
            do not resume sprinting where you left off — restart Block{' '}
            {missedWeeks.restartBlockStartWeek}. This never changes any workout you already
            completed.
          </AppText>
          <Button onPress={handleRestartAtBlockStart} loading={restarting}>
            Restart at Week {missedWeeks.restartBlockStartWeek}
          </Button>
        </Card>
      ) : null}

      {showTestingBanner ? (
        <Card className="mb-4">
          <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
            TESTING WINDOW
          </AppText>
          <AppText variant="body" color="primary">
            {scheduledDay.weekContext.isRetest
              ? 'This is your Week 6 partial retest window — see the Testing tab.'
              : 'This is your Week 12 taper and full test week — see the Testing tab.'}
          </AppText>
        </Card>
      ) : null}

      {readinessEvaluation?.requiresConfirmation ? (
        <Card className="mb-4" emphasized>
          <Badge label="Safety warning" tone="danger" />
          <AppText variant="body" color="primary" style={{ marginTop: 8 }}>
            {readinessEvaluation.triggers.length} rule
            {readinessEvaluation.triggers.length > 1 ? 's' : ''} triggered today. Review the
            adjustment before training.
          </AppText>
        </Card>
      ) : null}

      <SessionCard
        slotLabel="AM"
        session={scheduledDay.am}
        workoutSession={amWorkoutSession}
        actionLabel={
          amWorkoutSession?.status === 'completed'
            ? 'Review'
            : amWorkoutSession?.status === 'in_progress'
              ? 'Resume'
              : scheduledDay.am.requiresReadinessCheck && !readinessEntry
                ? 'Readiness check'
                : 'Start session'
        }
        actionLoading={pendingAction === 'am'}
        onAction={scheduledDay.am.isRestDay ? null : () => handleSessionAction('am')}
      />
      <SessionCard
        slotLabel="PM"
        session={scheduledDay.pm}
        workoutSession={pmWorkoutSession}
        actionLabel={
          pmWorkoutSession?.status === 'completed'
            ? 'Review'
            : pmWorkoutSession?.status === 'in_progress'
              ? 'Resume'
              : scheduledDay.pm.requiresReadinessCheck && !readinessEntry
                ? 'Readiness check'
                : 'Start session'
        }
        actionLoading={pendingAction === 'pm'}
        onAction={scheduledDay.pm.isRestDay ? null : () => handleSessionAction('pm')}
      />

      {scheduledDay.am.isRestDay && scheduledDay.pm.isRestDay ? (
        <>
          <Divider className="my-4" />
          <AppText variant="body" color="secondary">
            Rest day. An easy 20–30 minute walk or the standalone mobility flow is optional — not
            scheduled or tracked like a training day.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}
