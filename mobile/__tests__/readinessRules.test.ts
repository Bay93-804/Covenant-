import {
  applyAdjustmentsToStrengthDay,
  evaluateReadiness,
  type ReadinessHistoryEntry,
  type ReadinessInput,
} from '../src/features/readiness/readinessRules';
import { getStrengthDayForWeek } from '../src/content/repository';

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    entryDate: '2026-02-02',
    sleepHours: 8,
    restingHr: 50,
    baselineRestingHr: 50,
    calfAchillesFlag: false,
    hamstringGrabbyFlag: false,
    jointPainFlag: false,
    readinessScore: 4,
    ...overrides,
  };
}

describe('evaluateReadiness', () => {
  it('produces no triggers on a clean readiness check-in', () => {
    const result = evaluateReadiness(baseInput());
    expect(result.triggers).toHaveLength(0);
    expect(result.requiresConfirmation).toBe(false);
  });

  it('sleep under 6 hours blocks speed work and drops strength to RIR 4, skipping Cluster C', () => {
    const result = evaluateReadiness(baseInput({ sleepHours: 5.5 }));
    expect(result.triggers.map((t) => t.code)).toContain('SLEEP_UNDER_6H');
    expect(result.adjustments.doNotSprint).toBe(true);
    expect(result.adjustments.strengthRirOverride).toBe(4);
    expect(result.adjustments.removeClusterC).toBe(true);
  });

  it('does not trigger the sleep rule at exactly 6 hours', () => {
    const result = evaluateReadiness(baseInput({ sleepHours: 6 }));
    expect(result.triggers.map((t) => t.code)).not.toContain('SLEEP_UNDER_6H');
  });

  it('requires 3 CONSECUTIVE elevated mornings before triggering the RHR rule', () => {
    const history: ReadinessHistoryEntry[] = [
      { entryDate: '2026-02-01', restingHr: 58, baselineRestingHr: 50, calfAchillesFlag: false },
      { entryDate: '2026-01-31', restingHr: 58, baselineRestingHr: 50, calfAchillesFlag: false },
    ];
    const result = evaluateReadiness(baseInput({ restingHr: 58 }), history);
    expect(result.triggers.map((t) => t.code)).toContain('RHR_ELEVATED');
    expect(result.adjustments.useDeloadLoading).toBe(true);
    expect(result.adjustments.removeClusterC).toBe(true);
    expect(result.adjustments.doNotSprint).toBe(true);
  });

  it('does not trigger the RHR rule if only 2 of the 3 mornings are elevated', () => {
    const history: ReadinessHistoryEntry[] = [
      { entryDate: '2026-02-01', restingHr: 58, baselineRestingHr: 50, calfAchillesFlag: false },
      { entryDate: '2026-01-31', restingHr: 51, baselineRestingHr: 50, calfAchillesFlag: false },
    ];
    const result = evaluateReadiness(baseInput({ restingHr: 58 }), history);
    expect(result.triggers.map((t) => t.code)).not.toContain('RHR_ELEVATED');
  });

  it('does not trigger the RHR rule with a gap day (missing morning breaks "consecutive")', () => {
    const history: ReadinessHistoryEntry[] = [
      { entryDate: '2026-01-31', restingHr: 58, baselineRestingHr: 50, calfAchillesFlag: false },
      // 2026-02-01 missing entirely
    ];
    const result = evaluateReadiness(baseInput({ restingHr: 58 }), history);
    expect(result.triggers.map((t) => t.code)).not.toContain('RHR_ELEVATED');
  });

  it('flags calf/Achilles today and blocks sprinting + plyometrics', () => {
    const result = evaluateReadiness(baseInput({ calfAchillesFlag: true }));
    expect(result.triggers.map((t) => t.code)).toContain('CALF_ACHILLES_WARNING');
    expect(result.adjustments.doNotSprint).toBe(true);
    expect(result.adjustments.blockPlyometrics).toBe(true);
  });

  it('keeps the calf/Achilles block active until 72 hours after the last flag', () => {
    const history: ReadinessHistoryEntry[] = [
      { entryDate: '2026-01-31', restingHr: 50, baselineRestingHr: 50, calfAchillesFlag: true },
    ];
    // 2026-02-02 is only 48 hours after 2026-01-31 — still inside the 72h clearance window.
    const stillBlocked = evaluateReadiness(baseInput({ entryDate: '2026-02-02' }), history);
    expect(stillBlocked.triggers.map((t) => t.code)).toContain('CALF_ACHILLES_WARNING');

    // 2026-02-04 is 96 hours later — clear.
    const cleared = evaluateReadiness(baseInput({ entryDate: '2026-02-04' }), history);
    expect(cleared.triggers.map((t) => t.code)).not.toContain('CALF_ACHILLES_WARNING');
  });

  it('hamstring grabby stops sprinting, substitutes the easy run, and returns to hills for a week', () => {
    const result = evaluateReadiness(baseInput({ hamstringGrabbyFlag: true }));
    expect(result.triggers.map((t) => t.code)).toContain('HAMSTRING_GRABBY');
    expect(result.adjustments.substituteSprintsWithEasyRun).toBe(true);
    expect(result.adjustments.returnToHillsForOneWeek).toBe(true);
  });

  it('joint pain stops the affected training and recommends professional evaluation, never a workaround', () => {
    const result = evaluateReadiness(
      baseInput({ jointPainFlag: true, jointPainLocation: 'left knee' }),
    );
    const trigger = result.triggers.find((t) => t.code === 'JOINT_PAIN_MOVEMENT_CHANGE');
    expect(trigger?.recommendEvaluation).toBe(true);
    expect(result.adjustments.stopAffectedTraining).toBe(true);
    expect(result.adjustments.recommendProfessionalEvaluation).toBe(true);
  });

  it('never silently mutates: every trigger carries a human-readable reason and recommendation', () => {
    const result = evaluateReadiness(
      baseInput({ sleepHours: 5, calfAchillesFlag: true, jointPainFlag: true }),
    );
    for (const trigger of result.triggers) {
      expect(trigger.reason.length).toBeGreaterThan(0);
      expect(trigger.recommendation.length).toBeGreaterThan(0);
    }
  });
});

describe('applyAdjustmentsToStrengthDay', () => {
  it('removes only Cluster C and leaves the original object untouched', () => {
    const resolved = getStrengthDayForWeek('A', 1)!;
    const { adjustments } = evaluateReadiness(baseInput({ sleepHours: 5 }));
    const adjusted = applyAdjustmentsToStrengthDay(resolved.dayBlock, adjustments);

    expect(adjusted.original).toBe(resolved.dayBlock);
    expect(adjusted.original.clusters.some((c) => c.id === 'C')).toBe(
      resolved.dayBlock.clusters.some((c) => c.id === 'C'),
    );
    expect(adjusted.clusters.some((c) => c.id === 'C')).toBe(false);
    expect(adjusted.rirOverrideApplied).toBe(4);
  });

  it('keeps every cluster when no adjustment removes Cluster C', () => {
    const resolved = getStrengthDayForWeek('A', 1)!;
    const { adjustments } = evaluateReadiness(baseInput());
    const adjusted = applyAdjustmentsToStrengthDay(resolved.dayBlock, adjustments);
    expect(adjusted.clusters).toHaveLength(resolved.dayBlock.clusters.length);
  });
});
