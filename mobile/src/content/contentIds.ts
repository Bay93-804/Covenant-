/**
 * Runtime-side mirror of the id-derivation formulas in
 * `src/content/seed/expandProgram.ts`, for PM strength content only (the
 * only content this phase's Guided Workout Player logs per-exercise/per-set
 * data against — see `src/features/workout/sessionPlanBuilder.ts` for why AM
 * sessions, which are prose-described blocks in the source PDF rather than a
 * clean sets/reps grid, are logged at the session/journal level instead).
 *
 * These MUST stay byte-for-byte in sync with the id() calls in
 * expandProgram.ts's `workoutTemplates`/`workoutExercises` construction —
 * that's what lets a `completed_sets.workout_exercise_id` written by the app
 * match the row `npm run seed:supabase` writes to `workout_exercises`,
 * without the app needing to run the full 12-week expansion just to look up
 * one id. If expandProgram.ts's derivation ever changes, this must change
 * with it (there's a cross-check in __tests__/contentIds.test.ts).
 */
import { deterministicId, programVersionIdForSlug } from './seed/deterministicId';
import type { DayOfWeekIndex, StrengthDayLetter } from './repository';
import { DEFAULT_PROGRAM_VERSION_SLUG, type ProgramVersionSlug } from './source';

const STRENGTH_DAY_OF_WEEK: Record<StrengthDayLetter, DayOfWeekIndex> = {
  A: 0, // Monday
  B: 1, // Tuesday
  C: 3, // Thursday
  D: 5, // Saturday
};

export function programWeekId(
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  return deterministicId('program_week', programVersionIdForSlug(slug), weekNumber);
}

export function programDayId(
  weekNumber: number,
  dayOfWeek: DayOfWeekIndex,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  return deterministicId('program_day', programWeekId(weekNumber, slug), dayOfWeek);
}

export function strengthWorkoutTemplateId(
  letter: StrengthDayLetter,
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  const dayId = programDayId(weekNumber, STRENGTH_DAY_OF_WEEK[letter], slug);
  return deterministicId('workout_template', dayId, 'pm');
}

export function strengthWorkoutExerciseId(
  letter: StrengthDayLetter,
  weekNumber: number,
  exerciseOrder: string,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  const templateId = strengthWorkoutTemplateId(letter, weekNumber, slug);
  return deterministicId('workout_exercise', templateId, exerciseOrder);
}

/** AM workout_templates exist for weeks 1-12 only (see expandProgram.ts's AM_DAY_MAP). */
export function amWorkoutTemplateId(
  dayOfWeek: DayOfWeekIndex,
  weekNumber: number,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  const dayId = programDayId(weekNumber, dayOfWeek, slug);
  return deterministicId('workout_template', dayId, 'am');
}

/** Tuesday Core/Balance/Brake is the only AM session with per-movement `workout_exercises` rows. */
export function tuesdayCoreBalanceBrakeExerciseId(
  weekNumber: number,
  movementOrder: string,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): string {
  const templateId = amWorkoutTemplateId(1 as DayOfWeekIndex, weekNumber, slug);
  return deterministicId('workout_exercise', templateId, movementOrder);
}
