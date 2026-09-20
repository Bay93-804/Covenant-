/**
 * Data + mutations for the workout overview/player/summary screens. Loads
 * the session, rebuilds its plan (applying any confirmed readiness
 * adjustments for that date), and loads whatever sets are already logged —
 * so reopening a session (after backgrounding, a crash, or just navigating
 * away) restores exactly where the athlete left off.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import { useEnrollmentSchedule } from '../program/useEnrollmentSchedule';
import { addDays } from '../schedule/dateUtils';
import { buildScheduledDay } from '../schedule/scheduleEngine';
import { evaluateReadiness } from '../readiness/readinessRules';
import { buildSessionPlayerPlan, type PlayerSessionPlan } from './sessionPlanBuilder';
import {
  abandonSession,
  completeSession,
  createJournalEntry,
  getPreviousCompletedSets,
  getReadinessEntry,
  getSessionById,
  listCompletedSetsForSession,
  listReadinessHistory,
  startSession,
  upsertCompletedSet,
} from './workoutRepository';
import type { CompletedSetInput, CreateJournalEntryInput, WorkoutSession } from './types';

export interface WorkoutPlayerData {
  session: WorkoutSession;
  plan: PlayerSessionPlan;
  completedSets: Awaited<ReturnType<typeof listCompletedSetsForSession>>;
}

async function fetchWorkoutPlayerData(
  userId: string,
  sessionId: string,
  scheduleInput: Parameters<typeof buildScheduledDay>[0],
): Promise<WorkoutPlayerData> {
  const session = await getSessionById(userId, sessionId);
  if (!session) throw new Error(`Workout session ${sessionId} not found`);

  const scheduledDay = buildScheduledDay(scheduleInput, session.scheduled_date);
  const readinessEntry = await getReadinessEntry(userId, session.scheduled_date);

  let readinessAdjustments;
  if (readinessEntry) {
    const history = await listReadinessHistory(
      userId,
      addDays(session.scheduled_date, -4),
      addDays(session.scheduled_date, -1),
    );
    readinessAdjustments = evaluateReadiness(
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
    ).adjustments;
  }

  const plan = buildSessionPlayerPlan({
    scheduledDay,
    slot: session.session_slot,
    readinessAdjustments,
  });
  const completedSets = await listCompletedSetsForSession(userId, sessionId);

  return { session, plan, completedSets };
}

export function useWorkoutPlayerData(sessionId: string) {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();

  return useQuery({
    queryKey: ['workout-player', user?.id, sessionId],
    queryFn: () => fetchWorkoutPlayerData(user!.id, sessionId, scheduleContext!.scheduleInput),
    enabled: Boolean(user && sessionId && scheduleContext),
  });
}

export function usePreviousPerformance(workoutExerciseId: string, excludingSessionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['previous-performance', user?.id, workoutExerciseId, excludingSessionId],
    queryFn: () => getPreviousCompletedSets(user!.id, workoutExerciseId, excludingSessionId),
    enabled: Boolean(user && workoutExerciseId),
  });
}

export function useStartSession(sessionId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startSession(user!.id, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-player', user?.id, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
    },
  });
}

export function useLogSet(sessionId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CompletedSetInput, 'id' | 'userId' | 'workoutSessionId'>) =>
      upsertCompletedSet({ ...input, id: '', userId: user!.id, workoutSessionId: sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-player', user?.id, sessionId] });
    },
  });
}

export function useCompleteSession(sessionId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { durationActualSeconds: number; completionPct: number }) =>
      completeSession(user!.id, sessionId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-player', user?.id, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
    },
  });
}

export function useAbandonSession(sessionId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => abandonSession(user!.id, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-sessions', user?.id] });
    },
  });
}

export function useAddJournalEntry(sessionId: string) {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: Omit<CreateJournalEntryInput, 'id' | 'userId' | 'workoutSessionId'>) =>
      createJournalEntry({ ...input, id: '', userId: user!.id, workoutSessionId: sessionId }),
  });
}
