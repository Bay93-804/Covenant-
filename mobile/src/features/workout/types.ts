/**
 * Backend-agnostic domain types for workout *instance* data. These are
 * identical in shape to the hand-written Supabase row types (they must be —
 * the whole point of the repository pattern here is that demo mode and
 * Supabase mode share one set of business logic) but this module has zero
 * dependency on `src/lib/supabase/`, so `src/features/workout/` code never
 * needs to know or care which backend is active.
 */
import type {
  CompletedSetRow,
  EnrollmentPauseEventRow,
  ExerciseMaxRow,
  JournalEntryRow,
  PersonalRecordRow,
  ReadinessEntryRow,
  SafetyAdjustmentRow,
  SafetyTriggerCode,
  SportSessionRow,
  UnitsWeight,
  WorkoutSessionRow,
  WorkoutStatus,
} from '../../lib/supabase/database.types';

export type WorkoutSession = WorkoutSessionRow;
export type CompletedSet = CompletedSetRow;
export type ReadinessEntry = ReadinessEntryRow;
export type SafetyAdjustment = SafetyAdjustmentRow;
export type SportSession = SportSessionRow;
export type JournalEntry = JournalEntryRow;
export type ExerciseMax = ExerciseMaxRow;
export type PersonalRecord = PersonalRecordRow;
export type EnrollmentPauseEvent = EnrollmentPauseEventRow;
export type { SafetyTriggerCode, UnitsWeight, WorkoutStatus };

export interface CreateSessionInput {
  id: string;
  enrollmentId: string;
  userId: string;
  scheduledDate: string;
  sessionSlot: 'am' | 'pm';
  sessionType: string;
  weekNumber: number;
  dayOfWeek: number;
  strengthLetter?: 'A' | 'B' | 'C' | 'D' | null;
}

export interface CompletedSetInput {
  id: string;
  workoutSessionId: string;
  /** A deterministic content id from src/content/contentIds.ts — see that module's header for why only PM strength exercises have one. */
  workoutExerciseId: string;
  userId: string;
  setNumber: number;
  side?: 'left' | 'right' | 'both' | null;
  weight?: number | null;
  weightUnit?: UnitsWeight | null;
  reps?: number | null;
  actualRir?: number | null;
  timeSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: 'mi' | 'km' | null;
  sprintTime?: number | null;
  qualityRating?: number | null;
  technique_rating?: number | null;
  painFlag?: boolean;
  painNote?: string | null;
  completionStatus?: 'completed' | 'skipped' | 'partial';
  notes?: string | null;
}

export interface CreateReadinessInput {
  id: string;
  userId: string;
  workoutSessionId?: string | null;
  entryDate: string;
  sleepHours: number | null;
  restingHr: number | null;
  baselineRestingHr: number | null;
  calfAchillesFlag: boolean;
  hamstringGrabbyFlag: boolean;
  jointPainFlag: boolean;
  jointPainLocation?: string | null;
  readinessScore: number | null;
  notes?: string | null;
}

export interface CreateSafetyAdjustmentInput {
  id: string;
  userId: string;
  workoutSessionId?: string | null;
  readinessEntryId?: string | null;
  triggerCode: SafetyTriggerCode;
  reason: string;
  recommendedAdjustment: string;
  originalPrescriptionSnapshot?: unknown;
  adjustedPrescriptionSnapshot?: unknown;
}

export interface CreateSportSessionInput {
  id: string;
  userId: string;
  playedOn: string;
  sport: string;
  gamesThisWeek: number;
  appliedAdjustmentCode?: string | null;
  appliedAdjustmentNote?: string | null;
  affectedWorkoutSessionId?: string | null;
  notes?: string | null;
  originalPrescriptionSnapshot?: unknown;
  adjustedPrescriptionSnapshot?: unknown;
  /** True when the caller's UI action is itself the athlete's confirmation (e.g. a single "Confirm adjustment" button) — sets `user_confirmed`/`confirmed_at` at creation instead of requiring a separate confirmSportSession call. */
  userConfirmed?: boolean;
}

export interface CreateJournalEntryInput {
  id: string;
  userId: string;
  level: 'set' | 'exercise' | 'workout' | 'day';
  workoutSessionId?: string | null;
  workoutExerciseId?: string | null;
  completedSetId?: string | null;
  promptKey?: string | null;
  content: string;
}

export interface CreateExerciseMaxInput {
  id: string;
  userId: string;
  liftKey: string;
  estimated1Rm: number;
  weightUnit: UnitsWeight;
  method?: string;
  source?: 'manual' | 'testing_session' | 'week8_recalc' | 'set_derived';
}

export interface CreatePersonalRecordInput {
  id: string;
  userId: string;
  recordType: string;
  referenceKey: string;
  valueNumeric: number;
  unit: string;
  workoutSessionId?: string | null;
}
