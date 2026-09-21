/**
 * Reuses the Phase 3 readiness/safety rules engine (never duplicates its
 * thresholds) to gate maximal-effort testing markers — the Athletic Five
 * (#11-15: sprint, broad jump, CMJ, 5-10-5, deceleration deficit) — behind
 * the same calf/Achilles, hamstring, and joint-pain rules that gate a
 * training day's sprint/plyo work. "Never bypass Achilles, calf, hamstring,
 * or pain-related safety gates" (Phase 4 brief §D) applies here exactly as
 * it does to a normal training session; a maximal-effort test is at least as
 * risky as a training set of the same movement.
 */
import { evaluateReadiness, type ReadinessHistoryEntry } from '../readiness/readinessRules';
import type { IsoDate } from '../schedule/dateUtils';

const BLOCKING_CODES = new Set([
  'CALF_ACHILLES_WARNING',
  'HAMSTRING_GRABBY',
  'JOINT_PAIN_MOVEMENT_CHANGE',
]);

export interface MaximalEffortSafetyResult {
  blocked: boolean;
  reasons: string[];
}

/**
 * `latestFlags` should come from the most recent readiness check-in at or
 * before `testDate`; `history` should cover at least the 3 prior calendar
 * days (same window `useReadinessGate.ts` fetches) so the calf/Achilles
 * 72-hour clearance rule evaluates correctly.
 */
export function evaluateMaximalEffortSafetyGate(
  latestFlags: {
    calfAchillesFlag: boolean;
    hamstringGrabbyFlag: boolean;
    jointPainFlag: boolean;
    jointPainLocation?: string | null;
  } | null,
  testDate: IsoDate,
  history: ReadinessHistoryEntry[],
): MaximalEffortSafetyResult {
  if (!latestFlags) return { blocked: false, reasons: [] };

  const evaluation = evaluateReadiness(
    {
      entryDate: testDate,
      sleepHours: null,
      restingHr: null,
      baselineRestingHr: null,
      calfAchillesFlag: latestFlags.calfAchillesFlag,
      hamstringGrabbyFlag: latestFlags.hamstringGrabbyFlag,
      jointPainFlag: latestFlags.jointPainFlag,
      jointPainLocation: latestFlags.jointPainLocation,
      readinessScore: null,
    },
    history,
  );

  const blocking = evaluation.triggers.filter((t) => BLOCKING_CODES.has(t.code));
  return { blocked: blocking.length > 0, reasons: blocking.map((t) => t.reason) };
}
