/**
 * Combines the schedule engine + workout-instance repository into
 * everything the Today screen needs: today's AM/PM scheduled sessions
 * (content), any existing `workout_sessions` rows (instance/progress) for
 * them, today's readiness check-in (if any) and its evaluation, and
 * missed-week detection for the restart-recommendation banner.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import { addDays } from '../schedule/dateUtils';
import { detectMissedWeeks, type MissedWeeksResult } from '../schedule/missedWeeks';
import {
  buildScheduledDay,
  type EnrollmentScheduleInput,
  type ScheduledDay,
} from '../schedule/scheduleEngine';
import { evaluateReadiness, type ReadinessEvaluation } from '../readiness/readinessRules';
import {
  getReadinessEntry,
  getSession,
  listReadinessHistory,
  listSafetyAdjustments,
  listSessionsInRange,
  listSportSessions,
} from '../workout/workoutRepository';
import { isSessionAdjusted } from '../workout/sessionAdjustment';
import type { ReadinessEntry, WorkoutSession } from '../workout/types';

export interface TodaySessionsResult {
  scheduledDay: ScheduledDay;
  amWorkoutSession: WorkoutSession | null;
  pmWorkoutSession: WorkoutSession | null;
  amAdjusted: boolean;
  pmAdjusted: boolean;
  readinessEntry: ReadinessEntry | null;
  readinessEvaluation: ReadinessEvaluation | null;
  missedWeeks: MissedWeeksResult;
}

async function fetchTodaySessions(
  userId: string,
  enrollmentId: string,
  scheduleInput: EnrollmentScheduleInput,
  todayIsoDate: string,
): Promise<TodaySessionsResult> {
  const scheduledDay = buildScheduledDay(scheduleInput, todayIsoDate);

  const [amWorkoutSession, pmWorkoutSession, readinessEntry] = await Promise.all([
    scheduledDay.am.isRestDay
      ? Promise.resolve(null)
      : getSession(userId, enrollmentId, todayIsoDate, 'am'),
    scheduledDay.pm.isRestDay
      ? Promise.resolve(null)
      : getSession(userId, enrollmentId, todayIsoDate, 'pm'),
    getReadinessEntry(userId, todayIsoDate),
  ]);

  let readinessEvaluation: ReadinessEvaluation | null = null;
  if (readinessEntry) {
    const history = await listReadinessHistory(
      userId,
      addDays(todayIsoDate, -4),
      addDays(todayIsoDate, -1),
    );
    readinessEvaluation = evaluateReadiness(
      {
        entryDate: readinessEntry.entry_date,
        sleepHours: readinessEntry.sleep_hours,
        restingHr: readinessEntry.resting_hr,
        baselineRestingHr: readinessEntry.baseline_resting_hr,
        calfAchillesFlag: readinessEntry.calf_achilles_flag,
        hamstringGrabbyFlag: readinessEntry.hamstring_grabby_flag,
        jointPainFlag: readinessEntry.joint_pain_flag,
        jointPainLocation: readinessEntry.joint_pain_location,
        readinessScore: readinessEntry.readiness_score,
        notes: readinessEntry.notes,
      },
      history.map((h) => ({
        entryDate: h.entry_date,
        restingHr: h.resting_hr,
        baselineRestingHr: h.baseline_resting_hr,
        calfAchillesFlag: h.calf_achilles_flag,
      })),
    );
  }

  const sessionsInRange = await listSessionsInRange(
    userId,
    enrollmentId,
    scheduleInput.startDate,
    todayIsoDate,
  );
  // 'adjusted' is a legacy status value the app never writes (see
  // src/features/workout/sessionAdjustment.ts) — a trained session's status
  // is always 'completed' whether or not it was also adjusted.
  const completedDates = new Set(
    sessionsInRange.filter((s) => s.status === 'completed').map((s) => s.scheduled_date),
  );
  const missedWeeks = detectMissedWeeks(scheduleInput, todayIsoDate, completedDates);

  const [safetyAdjustments, sportSessions] = await Promise.all([
    listSafetyAdjustments(userId),
    listSportSessions(userId),
  ]);
  const amAdjusted = amWorkoutSession
    ? isSessionAdjusted(amWorkoutSession, safetyAdjustments, sportSessions)
    : false;
  const pmAdjusted = pmWorkoutSession
    ? isSessionAdjusted(pmWorkoutSession, safetyAdjustments, sportSessions)
    : false;

  return {
    scheduledDay,
    amWorkoutSession,
    pmWorkoutSession,
    amAdjusted,
    pmAdjusted,
    readinessEntry,
    readinessEvaluation,
    missedWeeks,
  };
}

export function useTodaySessions(
  enrollmentId: string | undefined,
  scheduleInput: EnrollmentScheduleInput | undefined,
  todayIsoDate: string | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['today-sessions', user?.id, enrollmentId, todayIsoDate],
    queryFn: () => fetchTodaySessions(user!.id, enrollmentId!, scheduleInput!, todayIsoDate!),
    enabled: Boolean(user && enrollmentId && scheduleInput && todayIsoDate),
  });
}

export function useInvalidateTodaySessions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
}
