/**
 * The source PDF prescribes percentage loads per-exercise but never states
 * explicitly which of the athlete's three tracked estimated maxes (trap-bar
 * deadlift, back squat, bench press — see onboarding's starting-maxes step)
 * a given day's percentage column is a percentage *of*. Each strength day's
 * own authoritative `mainLift` field (`strengthDays.<letter>.<block>.mainLift`
 * in the program JSON) makes the intent clear, though its exact wording
 * varies by block — e.g. "DB Bench Press" (Block 1) vs. "Bench Press"
 * (Blocks 2-3), "Back or Goblet Squat" (Block 1) vs. "Back Squat" (Blocks
 * 2-3). Rather than hard-coding a mapping by strength-day letter (A/B/C/D),
 * this classifies whatever `mainLift` string the resolved day actually
 * carries, so the program JSON stays the single source of truth: if a
 * future edition changes what a given day's main lift is, or reorders the
 * letters, this keeps working with no code change.
 *
 * Day D (Athletic Resilience) is kettlebell/bodyweight work with no
 * percentage-of-max prescriptions in the source PDF — its `mainLift`
 * ("Kettlebell Swing") matches none of these keywords, which is exactly
 * the signal to hide/disable the load calculator for it. The same applies
 * to any other day whose `mainLift` is absent or unrecognized: no lift key
 * is returned, so no e1RM lookup or recommended-load display happens.
 */
export type TrackedLiftKey = 'trap_bar_deadlift' | 'back_squat' | 'bench_press';

const KEYWORD_TO_LIFT_KEY: { pattern: RegExp; liftKey: TrackedLiftKey }[] = [
  { pattern: /trap[\s-]?bar/i, liftKey: 'trap_bar_deadlift' },
  { pattern: /squat/i, liftKey: 'back_squat' },
  { pattern: /bench/i, liftKey: 'bench_press' },
];

/**
 * Classifies a day's `mainLift` text into one of the three tracked lift
 * keys, or `null` when it doesn't match any of them (e.g. Day D's
 * "Kettlebell Swing", or any day with no `mainLift` at all) — the caller
 * should treat `null` as "no percentage-load calculator for this day".
 */
export function resolveLiftKeyFromMainLift(
  mainLift: string | null | undefined,
): TrackedLiftKey | null {
  if (!mainLift) return null;
  for (const { pattern, liftKey } of KEYWORD_TO_LIFT_KEY) {
    if (pattern.test(mainLift)) return liftKey;
  }
  return null;
}
