/**
 * Readiness & safety gate — implements docs/phase1's PDF-sourced back-off
 * rules exactly (see `data/program/*.json`'s `backOffSignals`, cross-checked
 * against the Phase 3 brief). This module only ever *evaluates*: it returns
 * triggers + recommended adjustment flags, and never mutates a prescription
 * itself. The caller (UI + `safety_adjustments` persistence) is responsible
 * for showing original vs. recommended and requiring explicit confirmation
 * before anything changes — see `describeAdjustments` below, which renders
 * human-readable copy for that confirmation screen, and
 * `applyAdjustmentsToStrengthDay` / `applyAdjustmentsToSpeedSession`, which
 * compute an *adjusted copy* alongside the untouched original.
 */
import type { StrengthCluster, StrengthDayBlock, WeeklySpeedPlanEntry } from '../../content/schema';
import type { IsoDate } from '../schedule/dateUtils';
import { diffDays } from '../schedule/dateUtils';

export type SafetyTriggerCode =
  | 'SLEEP_UNDER_6H'
  | 'RHR_ELEVATED'
  | 'CALF_ACHILLES_WARNING'
  | 'HAMSTRING_GRABBY'
  | 'JOINT_PAIN_MOVEMENT_CHANGE';

export interface ReadinessInput {
  entryDate: IsoDate;
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

/** A prior day's readiness entry, only the fields the rules need. */
export interface ReadinessHistoryEntry {
  entryDate: IsoDate;
  restingHr: number | null;
  baselineRestingHr: number | null;
  calfAchillesFlag: boolean;
}

export interface SafetyTrigger {
  code: SafetyTriggerCode;
  reason: string;
  recommendation: string;
  recommendEvaluation?: boolean;
}

/** What a triggered rule recommends changing — never applied without confirmation. */
export interface SessionAdjustmentFlags {
  doNotSprint: boolean;
  blockPlyometrics: boolean;
  useDeloadLoading: boolean;
  removeClusterC: boolean;
  strengthRirOverride: number | null;
  substituteSprintsWithEasyRun: boolean;
  returnToHillsForOneWeek: boolean;
  stopAffectedTraining: boolean;
  recommendProfessionalEvaluation: boolean;
}

export interface ReadinessEvaluation {
  triggers: SafetyTrigger[];
  adjustments: SessionAdjustmentFlags;
  requiresConfirmation: boolean;
}

const RHR_ELEVATION_THRESHOLD_BPM = 7;
const CALF_ACHILLES_CLEARANCE_HOURS = 72;

function emptyAdjustments(): SessionAdjustmentFlags {
  return {
    doNotSprint: false,
    blockPlyometrics: false,
    useDeloadLoading: false,
    removeClusterC: false,
    strengthRirOverride: null,
    substituteSprintsWithEasyRun: false,
    returnToHillsForOneWeek: false,
    stopAffectedTraining: false,
    recommendProfessionalEvaluation: false,
  };
}

function isElevated(restingHr: number | null, baseline: number | null): boolean {
  if (restingHr == null || baseline == null) return false;
  return restingHr - baseline >= RHR_ELEVATION_THRESHOLD_BPM;
}

/**
 * Evaluates a single readiness check-in against the PDF's back-off signals.
 * `history` should include, at minimum, the two calendar days immediately
 * before `input.entryDate` (for the 3-consecutive-mornings RHR rule) and any
 * days within the last 72 hours (for the calf/Achilles clearance rule) —
 * the caller (repository layer) is responsible for fetching that window.
 */
export function evaluateReadiness(
  input: ReadinessInput,
  history: ReadinessHistoryEntry[] = [],
): ReadinessEvaluation {
  const triggers: SafetyTrigger[] = [];
  const adjustments = emptyAdjustments();

  // --- Sleep under 6 hours -------------------------------------------------
  if (input.sleepHours != null && input.sleepHours < 6) {
    triggers.push({
      code: 'SLEEP_UNDER_6H',
      reason: `Logged sleep was ${input.sleepHours}h, under the 6-hour threshold.`,
      recommendation:
        'No speed session today. Strength work proceeds at RIR 4 (leave more in the tank) and skips Cluster C.',
    });
    adjustments.doNotSprint = true;
    adjustments.strengthRirOverride = 4;
    adjustments.removeClusterC = true;
  }

  // --- Resting heart rate ~7bpm above baseline, 3 consecutive mornings ----
  const recentByDate = new Map<IsoDate, ReadinessHistoryEntry>();
  for (const h of history) recentByDate.set(h.entryDate, h);
  recentByDate.set(input.entryDate, {
    entryDate: input.entryDate,
    restingHr: input.restingHr,
    baselineRestingHr: input.baselineRestingHr,
    calfAchillesFlag: input.calfAchillesFlag,
  });

  const lastThreeMornings = [0, 1, 2].map((offsetBack) => {
    const date = shiftIso(input.entryDate, -offsetBack);
    return recentByDate.get(date) ?? null;
  });
  const threeConsecutiveElevated =
    lastThreeMornings.every((e) => e != null) &&
    lastThreeMornings.every((e) => isElevated(e!.restingHr, e!.baselineRestingHr));

  if (threeConsecutiveElevated) {
    triggers.push({
      code: 'RHR_ELEVATED',
      reason: `Resting heart rate has been ~${RHR_ELEVATION_THRESHOLD_BPM}+ bpm above baseline for 3 consecutive mornings.`,
      recommendation: 'Use deload loading, remove Cluster C, and do not sprint today.',
    });
    adjustments.useDeloadLoading = true;
    adjustments.removeClusterC = true;
    adjustments.doNotSprint = true;
  }

  // --- Calf/Achilles: no sprinting/plyo until clear 72 hours --------------
  const lastFlaggedDate = [input, ...history]
    .filter((e) => e.calfAchillesFlag)
    .map((e) => e.entryDate)
    .sort()
    .pop();
  if (lastFlaggedDate) {
    const hoursSinceFlag = diffDays(lastFlaggedDate, input.entryDate) * 24;
    const stillWithinClearanceWindow = hoursSinceFlag < CALF_ACHILLES_CLEARANCE_HOURS;
    if (input.calfAchillesFlag || stillWithinClearanceWindow) {
      triggers.push({
        code: 'CALF_ACHILLES_WARNING',
        reason: input.calfAchillesFlag
          ? 'Calf or Achilles tightness, soreness, or a twinge was reported today.'
          : `Calf/Achilles was flagged on ${lastFlaggedDate} — not yet clear for 72 hours.`,
        recommendation: 'No sprinting or plyometrics until clear of symptoms for 72 hours.',
      });
      adjustments.doNotSprint = true;
      adjustments.blockPlyometrics = true;
    }
  }

  // --- Hamstring grabby ----------------------------------------------------
  if (input.hamstringGrabbyFlag) {
    triggers.push({
      code: 'HAMSTRING_GRABBY',
      reason: 'Hamstring felt grabby during build-ups.',
      recommendation:
        'Stop sprinting, perform the easy run instead, and return to hills for one week.',
    });
    adjustments.doNotSprint = true;
    adjustments.substituteSprintsWithEasyRun = true;
    adjustments.returnToHillsForOneWeek = true;
  }

  // --- Joint pain that changes movement -------------------------------------
  if (input.jointPainFlag) {
    triggers.push({
      code: 'JOINT_PAIN_MOVEMENT_CHANGE',
      reason: input.jointPainLocation
        ? `Joint pain that changes movement, reported at: ${input.jointPainLocation}.`
        : 'Joint pain that changes movement was reported.',
      recommendation:
        'Stop the affected training and see a qualified professional for evaluation. This is educational safety guidance, not a medical diagnosis.',
      recommendEvaluation: true,
    });
    adjustments.stopAffectedTraining = true;
    adjustments.recommendProfessionalEvaluation = true;
  }

  return { triggers, adjustments, requiresConfirmation: triggers.length > 0 };
}

function shiftIso(iso: IsoDate, deltaDays: number): IsoDate {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Applying adjustments to a prescription — always alongside the original,
// never in place of it.
// ---------------------------------------------------------------------------

export interface AdjustedStrengthDay {
  original: StrengthDayBlock;
  clusters: StrengthCluster[];
  removedClusterIds: string[];
  rirOverrideApplied: number | null;
  usedDeloadLoading: boolean;
}

export function applyAdjustmentsToStrengthDay(
  dayBlock: StrengthDayBlock,
  flags: SessionAdjustmentFlags,
): AdjustedStrengthDay {
  const removedClusterIds: string[] = [];
  let clusters = dayBlock.clusters;

  if (flags.removeClusterC) {
    clusters = clusters.filter((c) => {
      const isClusterC = c.id === 'C';
      if (isClusterC) removedClusterIds.push(c.id);
      return !isClusterC;
    });
  }

  return {
    original: dayBlock,
    clusters,
    removedClusterIds,
    rirOverrideApplied: flags.strengthRirOverride,
    usedDeloadLoading: flags.useDeloadLoading,
  };
}

export interface AdjustedSpeedSession {
  original: WeeklySpeedPlanEntry;
  sprintBlocked: boolean;
  plyometricsBlocked: boolean;
  substitutedWithEasyRun: boolean;
  note: string | null;
}

export function applyAdjustmentsToSpeedSession(
  speedPlan: WeeklySpeedPlanEntry,
  flags: SessionAdjustmentFlags,
): AdjustedSpeedSession {
  const notes: string[] = [];
  if (flags.doNotSprint)
    notes.push('Sprint work removed for today — proceed with the easy run only.');
  if (flags.blockPlyometrics) notes.push('Plyometrics removed for today.');
  if (flags.substituteSprintsWithEasyRun)
    notes.push('Return to hills (not flat sprints) for one week.');

  return {
    original: speedPlan,
    sprintBlocked: flags.doNotSprint,
    plyometricsBlocked: flags.blockPlyometrics,
    substitutedWithEasyRun: flags.substituteSprintsWithEasyRun,
    note: notes.length > 0 ? notes.join(' ') : null,
  };
}

/** Human-readable summary lines for the "safety adjustment confirmation" screen. */
export function describeTrigger(trigger: SafetyTrigger): {
  reason: string;
  recommendation: string;
} {
  return { reason: trigger.reason, recommendation: trigger.recommendation };
}
