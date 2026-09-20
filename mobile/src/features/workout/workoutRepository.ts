/**
 * The workout-instance repository. Every screen that reads or writes a
 * workout session, a completed set, a readiness entry, a safety adjustment,
 * a sport session, a journal entry, an exercise max, a personal record, or a
 * pause event goes through here — never straight to AsyncStorage or
 * Supabase. This is what "demo and Supabase modes share business logic"
 * (Phase 3 brief §7) means concretely: every function below reads/writes
 * the local offline store first (instant, works with no network, survives
 * app restart), and — only when Supabase is configured — also queues a
 * best-effort background push. Reads always come from the local store, so
 * the UI never blocks on network and always reflects the athlete's own
 * unsynced changes.
 */
import { isSupabaseConfigured } from '../../lib/env';
import {
  Collections,
  findById,
  generateId,
  hasPending,
  listAll,
  nowIso,
  queryAll,
  upsert,
} from '../../lib/offline/localWorkoutStore';
import { deterministicId } from '../../content/seed/deterministicId';
import {
  amWorkoutTemplateId,
  programDayId,
  strengthWorkoutTemplateId,
} from '../../content/contentIds';
import type { DayOfWeekIndex, StrengthDayLetter } from '../../content/repository';
import { queueBackgroundSync } from './syncEngine';
import type {
  CompletedSet,
  CompletedSetInput,
  CreateExerciseMaxInput,
  CreateJournalEntryInput,
  CreatePersonalRecordInput,
  CreateReadinessInput,
  CreateSafetyAdjustmentInput,
  CreateSessionInput,
  CreateSportSessionInput,
  EnrollmentPauseEvent,
  ExerciseMax,
  JournalEntry,
  PersonalRecord,
  ReadinessEntry,
  SafetyAdjustment,
  SportSession,
  WorkoutSession,
} from './types';

function maybeSync(userId: string) {
  if (isSupabaseConfigured) queueBackgroundSync(userId);
}

// ---------------------------------------------------------------------------
// Workout sessions
// ---------------------------------------------------------------------------

export async function getSession(
  userId: string,
  enrollmentId: string,
  scheduledDate: string,
  slot: 'am' | 'pm',
): Promise<WorkoutSession | null> {
  const rows = await queryAll<WorkoutSession>(
    userId,
    Collections.sessions,
    (s) =>
      s.enrollment_id === enrollmentId &&
      s.scheduled_date === scheduledDate &&
      s.session_slot === slot,
  );
  return rows[0] ?? null;
}

export async function getSessionById(
  userId: string,
  sessionId: string,
): Promise<WorkoutSession | null> {
  return findById<WorkoutSession>(userId, Collections.sessions, sessionId);
}

/** Creates a `scheduled` session row the first time a day is opened, or returns the existing one — never overwrites an existing row. */
export async function getOrCreateSession(input: CreateSessionInput): Promise<WorkoutSession> {
  if (input.sessionType === 'am_rest' || input.sessionType === 'pm_rest') {
    throw new Error('Rest days have no prescribed content and never get a workout_sessions row.');
  }
  const existing = await getSession(
    input.userId,
    input.enrollmentId,
    input.scheduledDate,
    input.sessionSlot,
  );
  if (existing) return existing;

  const now = nowIso();
  const dayOfWeek = input.dayOfWeek as DayOfWeekIndex;
  const templateId =
    input.sessionSlot === 'pm' && input.strengthLetter
      ? strengthWorkoutTemplateId(input.strengthLetter as StrengthDayLetter, input.weekNumber)
      : amWorkoutTemplateId(dayOfWeek, input.weekNumber);

  const row: WorkoutSession = {
    id: input.id,
    client_uuid: input.id,
    enrollment_id: input.enrollmentId,
    user_id: input.userId,
    program_day_id: programDayId(input.weekNumber, dayOfWeek),
    workout_template_id: templateId,
    scheduled_date: input.scheduledDate,
    session_slot: input.sessionSlot,
    status: 'scheduled',
    readiness_entry_id: null,
    started_at: null,
    completed_at: null,
    duration_actual_seconds: null,
    completion_pct: null,
    abandoned: false,
    synced_at: null,
    created_at: now,
    updated_at: now,
  };
  await upsert(input.userId, Collections.sessions, row);
  maybeSync(input.userId);
  return row;
}

export async function listSessionsInRange(
  userId: string,
  enrollmentId: string,
  fromDate: string,
  toDate: string,
): Promise<WorkoutSession[]> {
  return queryAll<WorkoutSession>(
    userId,
    Collections.sessions,
    (s) =>
      s.enrollment_id === enrollmentId &&
      s.scheduled_date >= fromDate &&
      s.scheduled_date <= toDate,
  );
}

export async function updateSession(
  userId: string,
  sessionId: string,
  patch: Partial<WorkoutSession>,
): Promise<WorkoutSession> {
  const existing = await findById<WorkoutSession>(userId, Collections.sessions, sessionId);
  if (!existing) throw new Error(`No workout session ${sessionId} for user ${userId}`);
  const next: WorkoutSession = { ...existing, ...patch, updated_at: nowIso() };
  await upsert(userId, Collections.sessions, next);
  maybeSync(userId);
  return next;
}

export async function startSession(userId: string, sessionId: string): Promise<WorkoutSession> {
  const existing = await findById<WorkoutSession>(userId, Collections.sessions, sessionId);
  if (existing?.started_at) return existing;
  return updateSession(userId, sessionId, { status: 'in_progress', started_at: nowIso() });
}

export async function completeSession(
  userId: string,
  sessionId: string,
  input: { durationActualSeconds: number; completionPct: number },
): Promise<WorkoutSession> {
  const existing = await findById<WorkoutSession>(userId, Collections.sessions, sessionId);
  // Duplicate-completion guard: completing an already-completed session is a no-op that returns the existing record.
  if (existing?.status === 'completed') return existing;
  return updateSession(userId, sessionId, {
    status: 'completed',
    completed_at: nowIso(),
    duration_actual_seconds: input.durationActualSeconds,
    completion_pct: input.completionPct,
  });
}

export async function abandonSession(userId: string, sessionId: string): Promise<WorkoutSession> {
  return updateSession(userId, sessionId, { abandoned: true });
}

// ---------------------------------------------------------------------------
// Completed sets — idempotent by (session, exercise, set number, side), so
// re-submitting the same set (a retried autosave, a duplicate tap) updates
// in place instead of creating a duplicate row.
// ---------------------------------------------------------------------------

export function completedSetId(
  workoutSessionId: string,
  workoutExerciseId: string,
  setNumber: number,
  side: string | null | undefined,
): string {
  return deterministicId(
    'completed_set',
    workoutSessionId,
    workoutExerciseId,
    setNumber,
    side ?? 'na',
  );
}

export async function upsertCompletedSet(input: CompletedSetInput): Promise<CompletedSet> {
  const id =
    input.id ||
    completedSetId(input.workoutSessionId, input.workoutExerciseId, input.setNumber, input.side);
  const existing = await findById<CompletedSet>(input.userId, Collections.sets, id);

  const row: CompletedSet = {
    id,
    client_uuid: id,
    workout_session_id: input.workoutSessionId,
    workout_exercise_id: input.workoutExerciseId,
    user_id: input.userId,
    set_number: input.setNumber,
    side: input.side ?? null,
    weight: input.weight ?? null,
    weight_unit: input.weightUnit ?? null,
    reps: input.reps ?? null,
    actual_rir: input.actualRir ?? null,
    time_seconds: input.timeSeconds ?? null,
    distance: input.distance ?? null,
    distance_unit: input.distanceUnit ?? null,
    pace: null,
    sprint_time: input.sprintTime ?? null,
    recovery_seconds: null,
    surface: null,
    effort_rating: null,
    quality_rating: input.qualityRating ?? null,
    technique_rating: input.technique_rating ?? null,
    pain_flag: input.painFlag ?? false,
    pain_note: input.painNote ?? null,
    completion_status: input.completionStatus ?? 'completed',
    notes: input.notes ?? null,
    completed_at: existing?.completed_at ?? nowIso(),
    synced_at: null,
    created_at: existing?.created_at ?? nowIso(),
  };
  await upsert(input.userId, Collections.sets, row);
  maybeSync(input.userId);
  return row;
}

export async function listCompletedSetsForSession(
  userId: string,
  sessionId: string,
): Promise<CompletedSet[]> {
  return queryAll<CompletedSet>(
    userId,
    Collections.sets,
    (s) => s.workout_session_id === sessionId,
  );
}

/** Most recent completed sets for this exercise, most recent session first — powers "previous performance". */
export async function getPreviousCompletedSets(
  userId: string,
  workoutExerciseId: string,
  excludingSessionId: string,
  limit = 8,
): Promise<CompletedSet[]> {
  const all = await queryAll<CompletedSet>(
    userId,
    Collections.sets,
    (s) =>
      s.workout_exercise_id === workoutExerciseId && s.workout_session_id !== excludingSessionId,
  );
  return all.sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Readiness entries — one per athlete per day; resubmitting the same day
// updates in place (deterministic id keyed on user + date).
// ---------------------------------------------------------------------------

export function readinessEntryId(userId: string, entryDate: string): string {
  return deterministicId('readiness_entry', userId, entryDate);
}

export async function createReadinessEntry(input: CreateReadinessInput): Promise<ReadinessEntry> {
  const id = input.id || readinessEntryId(input.userId, input.entryDate);
  const existing = await findById<ReadinessEntry>(input.userId, Collections.readiness, id);
  const row: ReadinessEntry = {
    id,
    client_uuid: id,
    user_id: input.userId,
    workout_session_id: input.workoutSessionId ?? null,
    entry_date: input.entryDate,
    sleep_hours: input.sleepHours,
    resting_hr: input.restingHr,
    baseline_resting_hr: input.baselineRestingHr,
    calf_achilles_flag: input.calfAchillesFlag,
    hamstring_grabby_flag: input.hamstringGrabbyFlag,
    joint_pain_flag: input.jointPainFlag,
    joint_pain_location: input.jointPainLocation ?? null,
    readiness_score: input.readinessScore,
    notes: input.notes ?? null,
    created_at: existing?.created_at ?? nowIso(),
  };
  await upsert(input.userId, Collections.readiness, row);
  maybeSync(input.userId);
  return row;
}

export async function getReadinessEntry(
  userId: string,
  entryDate: string,
): Promise<ReadinessEntry | null> {
  return findById<ReadinessEntry>(
    userId,
    Collections.readiness,
    readinessEntryId(userId, entryDate),
  );
}

/** Readiness history in `[sinceDate, untilDate]`, ascending by date — the window the safety rules need for 3-morning and 72-hour checks. */
export async function listReadinessHistory(
  userId: string,
  sinceDate: string,
  untilDate: string,
): Promise<ReadinessEntry[]> {
  const rows = await queryAll<ReadinessEntry>(
    userId,
    Collections.readiness,
    (r) => r.entry_date >= sinceDate && r.entry_date <= untilDate,
  );
  return rows.sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Safety adjustments
// ---------------------------------------------------------------------------

export async function createSafetyAdjustment(
  input: CreateSafetyAdjustmentInput,
): Promise<SafetyAdjustment> {
  const row: SafetyAdjustment = {
    id: input.id,
    user_id: input.userId,
    workout_session_id: input.workoutSessionId ?? null,
    readiness_entry_id: input.readinessEntryId ?? null,
    trigger_code: input.triggerCode,
    reason: input.reason,
    recommended_adjustment: input.recommendedAdjustment,
    original_prescription_snapshot: input.originalPrescriptionSnapshot ?? null,
    adjusted_prescription_snapshot: input.adjustedPrescriptionSnapshot ?? null,
    user_confirmed: false,
    confirmed_at: null,
    created_at: nowIso(),
  };
  await upsert(input.userId, Collections.safetyAdjustments, row);
  maybeSync(input.userId);
  return row;
}

export async function confirmSafetyAdjustment(
  userId: string,
  id: string,
): Promise<SafetyAdjustment> {
  const existing = await findById<SafetyAdjustment>(userId, Collections.safetyAdjustments, id);
  if (!existing) throw new Error(`No safety adjustment ${id}`);
  const next: SafetyAdjustment = { ...existing, user_confirmed: true, confirmed_at: nowIso() };
  await upsert(userId, Collections.safetyAdjustments, next);
  maybeSync(userId);
  return next;
}

export async function listSafetyAdjustments(userId: string): Promise<SafetyAdjustment[]> {
  return listAll<SafetyAdjustment>(userId, Collections.safetyAdjustments);
}

// ---------------------------------------------------------------------------
// Sport sessions
// ---------------------------------------------------------------------------

export async function createSportSession(input: CreateSportSessionInput): Promise<SportSession> {
  const row: SportSession = {
    id: input.id,
    user_id: input.userId,
    played_on: input.playedOn,
    sport: input.sport,
    games_this_week: input.gamesThisWeek,
    pregame_warmup_completed: false,
    applied_adjustment_code: input.appliedAdjustmentCode ?? null,
    applied_adjustment_note: input.appliedAdjustmentNote ?? null,
    user_confirmed: false,
    affected_workout_session_id: input.affectedWorkoutSessionId ?? null,
    notes: input.notes ?? null,
    created_at: nowIso(),
  };
  await upsert(input.userId, Collections.sportSessions, row);
  maybeSync(input.userId);
  return row;
}

export async function confirmSportSession(userId: string, id: string): Promise<SportSession> {
  const existing = await findById<SportSession>(userId, Collections.sportSessions, id);
  if (!existing) throw new Error(`No sport session ${id}`);
  const next: SportSession = { ...existing, user_confirmed: true };
  await upsert(userId, Collections.sportSessions, next);
  maybeSync(userId);
  return next;
}

export async function listSportSessions(userId: string): Promise<SportSession[]> {
  return listAll<SportSession>(userId, Collections.sportSessions);
}

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const row: JournalEntry = {
    id: input.id,
    user_id: input.userId,
    level: input.level,
    workout_session_id: input.workoutSessionId ?? null,
    workout_exercise_id: input.workoutExerciseId ?? null,
    completed_set_id: input.completedSetId ?? null,
    prompt_key: input.promptKey ?? null,
    content: input.content,
    created_at: nowIso(),
  };
  await upsert(input.userId, Collections.journal, row);
  maybeSync(input.userId);
  return row;
}

export async function listJournalEntriesForSession(
  userId: string,
  sessionId: string,
): Promise<JournalEntry[]> {
  return queryAll<JournalEntry>(
    userId,
    Collections.journal,
    (j) => j.workout_session_id === sessionId,
  );
}

// ---------------------------------------------------------------------------
// Exercise maxes (e1RM)
// ---------------------------------------------------------------------------

export async function createExerciseMax(input: CreateExerciseMaxInput): Promise<ExerciseMax> {
  const row: ExerciseMax = {
    id: input.id,
    user_id: input.userId,
    lift_key: input.liftKey,
    estimated_1rm: input.estimated1Rm,
    weight_unit: input.weightUnit,
    method: input.method ?? 'heavy_5_rir1_x1.15',
    source: input.source ?? 'manual',
    workout_session_id: null,
    testing_session_id: null,
    effective_from_week: null,
    recorded_at: nowIso(),
  };
  await upsert(input.userId, Collections.exerciseMaxes, row);
  maybeSync(input.userId);
  return row;
}

export async function getLatestExerciseMax(
  userId: string,
  liftKey: string,
): Promise<ExerciseMax | null> {
  const rows = await queryAll<ExerciseMax>(
    userId,
    Collections.exerciseMaxes,
    (m) => m.lift_key === liftKey,
  );
  if (rows.length === 0) return null;
  return rows.sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1))[0] ?? null;
}

export async function listExerciseMaxes(userId: string): Promise<ExerciseMax[]> {
  return listAll<ExerciseMax>(userId, Collections.exerciseMaxes);
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export async function createPersonalRecord(
  input: CreatePersonalRecordInput,
): Promise<PersonalRecord> {
  const row: PersonalRecord = {
    id: input.id,
    user_id: input.userId,
    record_type: input.recordType,
    reference_key: input.referenceKey,
    value_numeric: input.valueNumeric,
    unit: input.unit,
    achieved_at: nowIso(),
    workout_session_id: input.workoutSessionId ?? null,
    testing_result_id: null,
    created_at: nowIso(),
  };
  await upsert(input.userId, Collections.personalRecords, row);
  maybeSync(input.userId);
  return row;
}

export async function getBestPersonalRecord(
  userId: string,
  referenceKey: string,
): Promise<PersonalRecord | null> {
  const rows = await queryAll<PersonalRecord>(
    userId,
    Collections.personalRecords,
    (r) => r.reference_key === referenceKey,
  );
  if (rows.length === 0) return null;
  return rows.sort((a, b) => b.value_numeric - a.value_numeric)[0] ?? null;
}

export async function listPersonalRecords(userId: string): Promise<PersonalRecord[]> {
  return listAll<PersonalRecord>(userId, Collections.personalRecords);
}

// ---------------------------------------------------------------------------
// Enrollment pause events
// ---------------------------------------------------------------------------

export async function createPauseEvent(
  userId: string,
  enrollmentId: string,
  reason: string | null,
): Promise<EnrollmentPauseEvent> {
  const row: EnrollmentPauseEvent = {
    id: generateId(),
    enrollment_id: enrollmentId,
    user_id: userId,
    paused_at: nowIso(),
    resumed_at: null,
    reason,
    created_at: nowIso(),
  };
  await upsert(userId, Collections.pauseEvents, row);
  maybeSync(userId);
  return row;
}

export async function resumePauseEvent(userId: string, id: string): Promise<EnrollmentPauseEvent> {
  const existing = await findById<EnrollmentPauseEvent>(userId, Collections.pauseEvents, id);
  if (!existing) throw new Error(`No pause event ${id}`);
  const next: EnrollmentPauseEvent = { ...existing, resumed_at: nowIso() };
  await upsert(userId, Collections.pauseEvents, next);
  maybeSync(userId);
  return next;
}

export async function listPauseEvents(
  userId: string,
  enrollmentId: string,
): Promise<EnrollmentPauseEvent[]> {
  return queryAll<EnrollmentPauseEvent>(
    userId,
    Collections.pauseEvents,
    (p) => p.enrollment_id === enrollmentId,
  );
}

export async function getActivePauseEvent(
  userId: string,
  enrollmentId: string,
): Promise<EnrollmentPauseEvent | null> {
  const rows = await listPauseEvents(userId, enrollmentId);
  return rows.find((p) => p.resumed_at == null) ?? null;
}

// ---------------------------------------------------------------------------
// Offline status
// ---------------------------------------------------------------------------

export async function hasUnsyncedWorkoutData(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const collections = Object.values(Collections);
  for (const collection of collections) {
    if (await hasPending(userId, collection)) return true;
  }
  return false;
}

export { generateId };
