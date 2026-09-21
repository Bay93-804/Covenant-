/**
 * React Query wiring for the Progress dashboard — composes the Phase 3
 * workout/readiness repositories and the Phase 4 testing repository into
 * program adherence, exercise history, and readiness/adjustment trends.
 * Mirrors the composition pattern in src/features/program/useTodaySessions.ts.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import { useEnrollmentSchedule } from '../program/useEnrollmentSchedule';
import { buildScheduledDay, type EnrollmentScheduleInput } from '../schedule/scheduleEngine';
import { buildSessionPlayerPlan } from '../workout/sessionPlanBuilder';
import type { ReadinessEntry, SafetyAdjustment, SportSession } from '../workout/types';
import {
  listCompletedSetsForSession,
  listPauseEvents,
  listReadinessHistory,
  listSafetyAdjustments,
  listSessionsInRange,
  listSportSessions,
} from '../workout/workoutRepository';
import { computeProgramAdherence, type ProgramAdherenceSummary } from './adherence';
import {
  buildExerciseHistory,
  type ExerciseHistoryEntry,
  type NamedCompletedSet,
} from './exerciseHistory';
import {
  buildReadinessTrend,
  summarizePickupSport,
  summarizeSafetyFlags,
  type PickupSportSummary,
  type ReadinessTrendPoint,
  type SafetyFlagSummary,
} from './readinessTrends';

// ---------------------------------------------------------------------------
// Program adherence
// ---------------------------------------------------------------------------

async function fetchProgramAdherence(
  userId: string,
  enrollmentId: string,
  scheduleInput: EnrollmentScheduleInput,
  todayIso: string,
): Promise<ProgramAdherenceSummary> {
  const sessions = await listSessionsInRange(
    userId,
    enrollmentId,
    scheduleInput.startDate,
    todayIso,
  );
  return computeProgramAdherence(scheduleInput, todayIso, sessions);
}

export function useProgramAdherence() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: [
      'program-adherence',
      user?.id,
      scheduleContext?.enrollmentId,
      scheduleContext?.todayIso,
    ],
    queryFn: () =>
      fetchProgramAdherence(
        user!.id,
        scheduleContext!.enrollmentId,
        scheduleContext!.scheduleInput,
        scheduleContext!.todayIso,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}

// ---------------------------------------------------------------------------
// Exercise history
// ---------------------------------------------------------------------------

async function fetchExerciseHistory(
  userId: string,
  enrollmentId: string,
  scheduleInput: EnrollmentScheduleInput,
  todayIso: string,
): Promise<ExerciseHistoryEntry[]> {
  const sessions = await listSessionsInRange(
    userId,
    enrollmentId,
    scheduleInput.startDate,
    todayIso,
  );
  const loggedSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'adjusted',
  );

  const named: NamedCompletedSet[] = [];
  for (const session of loggedSessions) {
    const scheduledDay = buildScheduledDay(scheduleInput, session.scheduled_date);
    const slotSession = session.session_slot === 'am' ? scheduledDay.am : scheduledDay.pm;
    if (slotSession.isRestDay) continue;

    const plan = buildSessionPlayerPlan({ scheduledDay, slot: session.session_slot });
    if (!plan.supportsPerSetLogging || plan.exercises.length === 0) continue;
    const idToName = new Map(plan.exercises.map((e) => [e.workoutExerciseId, e.name]));

    const sets = await listCompletedSetsForSession(userId, session.id);
    for (const set of sets) {
      const name = idToName.get(set.workout_exercise_id);
      if (!name) continue;
      named.push({
        exerciseName: name,
        sessionId: session.id,
        scheduledDate: session.scheduled_date,
        weekNumber: scheduledDay.weekNumber,
        setNumber: set.set_number,
        side: set.side,
        weight: set.weight,
        weightUnit: set.weight_unit,
        reps: set.reps,
        actualRir: set.actual_rir,
        timeSeconds: set.time_seconds,
        distance: set.distance,
        distanceUnit: set.distance_unit,
        sprintTime: set.sprint_time,
        completionStatus: set.completion_status,
      });
    }
  }

  return buildExerciseHistory(named);
}

export function useExerciseHistory() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: [
      'exercise-history',
      user?.id,
      scheduleContext?.enrollmentId,
      scheduleContext?.todayIso,
    ],
    queryFn: () =>
      fetchExerciseHistory(
        user!.id,
        scheduleContext!.enrollmentId,
        scheduleContext!.scheduleInput,
        scheduleContext!.todayIso,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}

// ---------------------------------------------------------------------------
// Readiness + adjustment history
// ---------------------------------------------------------------------------

export interface ReadinessAndAdjustments {
  trend: ReadinessTrendPoint[];
  safetyFlags: SafetyFlagSummary[];
  pickupSport: PickupSportSummary;
  totalReadinessChecks: number;
  totalPauses: number;
  readinessEntries: ReadinessEntry[];
  safetyAdjustments: SafetyAdjustment[];
  sportSessions: SportSession[];
}

async function fetchReadinessAndAdjustments(
  userId: string,
  enrollmentId: string,
  scheduleInput: EnrollmentScheduleInput,
  todayIso: string,
): Promise<ReadinessAndAdjustments> {
  const [readiness, safetyAdjustments, sportSessions, pauseEvents] = await Promise.all([
    listReadinessHistory(userId, scheduleInput.startDate, todayIso),
    listSafetyAdjustments(userId),
    listSportSessions(userId),
    listPauseEvents(userId, enrollmentId),
  ]);

  return {
    trend: buildReadinessTrend(readiness),
    safetyFlags: summarizeSafetyFlags(safetyAdjustments),
    pickupSport: summarizePickupSport(sportSessions),
    totalReadinessChecks: readiness.length,
    totalPauses: pauseEvents.length,
    readinessEntries: [...readiness].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)),
    safetyAdjustments: [...safetyAdjustments].sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    ),
    sportSessions: [...sportSessions].sort((a, b) => (a.played_on < b.played_on ? 1 : -1)),
  };
}

export function useReadinessAndAdjustments() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: [
      'readiness-adjustments',
      user?.id,
      scheduleContext?.enrollmentId,
      scheduleContext?.todayIso,
    ],
    queryFn: () =>
      fetchReadinessAndAdjustments(
        user!.id,
        scheduleContext!.enrollmentId,
        scheduleContext!.scheduleInput,
        scheduleContext!.todayIso,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}

export { listSafetyAdjustments, listSportSessions };
