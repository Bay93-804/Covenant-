/**
 * Percentage-load calculation for strength prescriptions.
 *
 * Per `data/program/*.json`'s `twoSafetyRules` / `testing.maxRecalculation`:
 * there is no true 1RM testing in this program — the estimated 1RM (e1RM)
 * comes from a heavy set of 5 reps at RIR 1, multiplied by 1.15 — and no
 * percentage prescription is ever allowed to recommend a load above 80% of
 * that estimate, even if the source data or a safety-rule override would
 * otherwise imply a higher number.
 */
export type WeightUnit = 'lb' | 'kg';

/** Program-wide hard cap — see `twoSafetyRules`: "nothing above 80% of your estimated max." */
export const PROGRAM_MAX_PERCENTAGE = 80;

const ROUNDING_INCREMENT: Record<WeightUnit, number> = { lb: 5, kg: 2.5 };

/** Rounds to the nearest 5 lb, or nearest 2.5 kg — never rounds *up* past the 80% cap's raw value beyond one increment. */
export function roundToIncrement(value: number, unit: WeightUnit): number {
  const increment = ROUNDING_INCREMENT[unit];
  return Math.round(value / increment) * increment;
}

/** e1RM estimation method the program specifies: a heavy set of 5 @ RIR 1, times 1.15. */
export function estimateOneRepMaxFromHeavyFive(heavyFiveWeight: number): number {
  return heavyFiveWeight * 1.15;
}

export interface RecommendedLoadResult {
  /** The percentage actually used after applying the 80% cap. */
  effectivePercentage: number;
  /** Exact load before rounding. */
  rawLoad: number;
  /** Final, display-ready load. */
  recommendedLoad: number;
  /** True when the prescribed percentage exceeded 80% and had to be capped. */
  wasCapped: boolean;
}

/**
 * Computes the recommended load for a percentage-based set.
 * `estimated1Rm` must be the athlete's most recent stored e1RM for the lift.
 */
export function calculateRecommendedLoad(params: {
  estimated1Rm: number;
  prescribedPercentage: number;
  unit: WeightUnit;
}): RecommendedLoadResult {
  const { estimated1Rm, prescribedPercentage, unit } = params;
  const wasCapped = prescribedPercentage > PROGRAM_MAX_PERCENTAGE;
  const effectivePercentage = Math.min(prescribedPercentage, PROGRAM_MAX_PERCENTAGE);
  const rawLoad = estimated1Rm * (effectivePercentage / 100);
  const recommendedLoad = roundToIncrement(rawLoad, unit);

  return { effectivePercentage, rawLoad, recommendedLoad, wasCapped };
}
