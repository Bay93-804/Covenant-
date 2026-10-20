import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Button, Card, Screen } from '../../../src/design-system';
import { formatLongDate } from '../../../src/features/program/monthCalendar';
import { useEnrollmentSchedule } from '../../../src/features/program/useEnrollmentSchedule';
import { nextMondayOnOrAfter } from '../../../src/features/schedule/dateUtils';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { RestartProgramError, restartProgram } from '../../../src/lib/enrollment/enrollmentService';

type Step = 'warning' | 'confirm' | 'success';

/**
 * Restart Program: archives the current 12-week run (every workout, test,
 * check-in and date stays in history) and starts a fresh run at Week 1,
 * Day 1. Two explicit steps before anything changes; the operation itself
 * is idempotent server-side (see enrollmentService.restartProgram).
 */
export default function RestartProgramScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: scheduleContext, isLoading } = useEnrollmentSchedule();
  const [step, setStep] = useState<Step>('warning');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newStartDate, setNewStartDate] = useState<string | null>(null);
  const submitting = useRef(false);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (!scheduleContext || !user) {
    return (
      <Screen scroll>
        <AppText variant="h2" color="primary" style={{ marginTop: 16, marginBottom: 12 }}>
          Restart Program
        </AppText>
        <Card>
          <AppText variant="body" color="secondary">
            You don&apos;t have a current program run to restart.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const startDate = newStartDate ?? nextMondayOnOrAfter(scheduleContext.todayIso);
  const startsToday = startDate === scheduleContext.todayIso;

  async function handleConfirm() {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const next = await restartProgram(user!.id, scheduleContext!.enrollmentId, startDate);
      setNewStartDate(next.startDate);
      // Every cached screen (Today, Program, Progress, Testing) was keyed to
      // the old run — drop it all so nothing stale is shown for a frame.
      await queryClient.invalidateQueries();
      setStep('success');
    } catch (e) {
      setError(
        e instanceof RestartProgramError
          ? e.message
          : 'Restart failed — nothing was changed. Please try again.',
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  function goToCalendar() {
    router.dismissAll();
    router.navigate({ pathname: '/(tabs)/program', params: { focusDate: startDate } });
  }

  if (step === 'success') {
    return (
      <Screen scroll>
        <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
          NEW RUN STARTED
        </AppText>
        <AppText variant="h2" color="primary" style={{ marginBottom: 12 }}>
          Week 1 begins {formatLongDate(startDate)}
        </AppText>
        <Card className="mb-4">
          <AppText variant="body" color="secondary">
            Your previous run is archived. Its workouts, testing results and check-ins are kept in
            Progress → Past program runs.
          </AppText>
        </Card>
        <Button onPress={goToCalendar}>View Week 1 Calendar</Button>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="h2" color="primary" style={{ marginTop: 16, marginBottom: 12 }}>
        Restart Program
      </AppText>

      <Card className="mb-4" emphasized>
        <AppText variant="body" color="primary" weight="600" style={{ marginBottom: 8 }}>
          Your current program run will be archived.
        </AppText>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • A new run starts at Week 1, Day 1 on {formatLongDate(startDate, true)}
          {startsToday ? ' (today)' : ''}.
        </AppText>
        {!startsToday ? (
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
            • The days before then are your new Week 0 — time to redo baseline testing.
          </AppText>
        ) : null}
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
          • Nothing is deleted: completed workouts, testing results, check-ins, readiness data,
          dates, and performance history stay in Progress → Past program runs.
        </AppText>
        <AppText variant="bodySm" color="secondary">
          • The archived run can&apos;t be resumed once you restart.
        </AppText>
      </Card>

      {step === 'warning' ? (
        <View className="gap-3">
          <Button onPress={() => setStep('confirm')}>Continue</Button>
          <Button variant="secondary" onPress={() => router.back()}>
            Cancel
          </Button>
        </View>
      ) : (
        <View className="gap-3">
          <AppText variant="body" color="primary" weight="600">
            Are you sure? Archive this run and start over at Week 1?
          </AppText>
          {error ? (
            <View accessibilityLiveRegion="polite" accessibilityRole="alert">
              <AppText variant="bodySm" color="danger">
                {error}
              </AppText>
            </View>
          ) : null}
          <Button
            variant="danger"
            onPress={handleConfirm}
            loading={loading}
            testID="confirm-restart"
          >
            {error ? 'Try Again' : 'Yes, Archive and Restart'}
          </Button>
          <Button variant="secondary" onPress={() => router.back()} disabled={loading}>
            Keep Current Run
          </Button>
        </View>
      )}
    </Screen>
  );
}
