import type { StrengthDayLetter } from '../../content/repository';

/**
 * The source PDF prescribes percentage loads per-exercise but never states
 * explicitly which of the athlete's three tracked estimated maxes (trap-bar
 * deadlift, back squat, bench press — see onboarding's starting-maxes step)
 * a given day's percentage column is a percentage *of*. Each strength day's
 * own `mainLift` field makes the intent clear though: Strength A's main
 * lift is the Trap-Bar Deadlift, B's is (DB) Bench Press, C's is Back/
 * Goblet Squat, and D (Athletic Resilience) is kettlebell/bodyweight work
 * with no percentage-of-max prescriptions at all. This mapping makes that
 * explicit for the load calculator rather than leaving it implicit.
 */
export const LIFT_KEY_BY_STRENGTH_LETTER: Record<StrengthDayLetter, string | null> = {
  A: 'trap_bar_deadlift',
  B: 'bench_press',
  C: 'back_squat',
  D: null,
};
