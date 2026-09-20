import { buildSessionPlayerPlan } from '../src/features/workout/sessionPlanBuilder';
import { buildScheduledDay } from '../src/features/schedule/scheduleEngine';
import { evaluateReadiness } from '../src/features/readiness/readinessRules';

const scheduleInput = { startDate: '2026-01-05', timezone: 'America/New_York' };

describe('buildSessionPlayerPlan', () => {
  it('builds a full cluster/exercise/set plan for a PM strength day', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05'); // Monday, week 1
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'pm' });

    expect(plan.supportsPerSetLogging).toBe(true);
    expect(plan.strengthLetter).toBe('A');
    expect(plan.exercises.length).toBeGreaterThan(0);
    const first = plan.exercises[0]!;
    expect(first.workoutExerciseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.sets.length).toBeGreaterThan(0);
  });

  it('doubles sets for each-side exercises with left/right entries', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05');
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'pm' });
    const eachSideExercise = plan.exercises.find((e) => e.eachSide);
    expect(eachSideExercise).toBeDefined();
    const sides = eachSideExercise!.sets.map((s) => s.side);
    expect(sides).toContain('left');
    expect(sides).toContain('right');
  });

  it('removes Cluster C and overrides RIR when a safety adjustment is confirmed', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05');
    const { adjustments } = evaluateReadiness({
      entryDate: '2026-01-05',
      sleepHours: 5,
      restingHr: 50,
      baselineRestingHr: 50,
      calfAchillesFlag: false,
      hamstringGrabbyFlag: false,
      jointPainFlag: false,
      readinessScore: 3,
    });
    const plan = buildSessionPlayerPlan({
      scheduledDay: day,
      slot: 'pm',
      readinessAdjustments: adjustments,
    });
    expect(plan.exercises.some((e) => e.clusterId === 'C')).toBe(false);
    expect(plan.adjustmentSummary.some((s) => s.includes('Cluster'))).toBe(true);
  });

  it('builds a structured, per-set plan for Tuesday Core/Balance/Brake', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-06'); // Tuesday, week 1
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'am' });
    expect(plan.supportsPerSetLogging).toBe(true);
    expect(plan.exercises.length).toBeGreaterThan(0);
  });

  it('builds a segment checklist (not a fabricated sets table) for Monday Speed/Plyo', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05');
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'am' });
    expect(plan.supportsPerSetLogging).toBe(false);
    expect(plan.segments.map((s) => s.key)).toEqual(
      expect.arrayContaining(['warmup', 'plyometric', 'acceleration', 'easyRun', 'flow']),
    );
  });

  it('blocks the acceleration/plyometric segments when a safety rule says do-not-sprint', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05');
    const { adjustments } = evaluateReadiness({
      entryDate: '2026-01-05',
      sleepHours: 8,
      restingHr: 50,
      baselineRestingHr: 50,
      calfAchillesFlag: true,
      hamstringGrabbyFlag: false,
      jointPainFlag: false,
      readinessScore: 3,
    });
    const plan = buildSessionPlayerPlan({
      scheduledDay: day,
      slot: 'am',
      readinessAdjustments: adjustments,
    });
    const accel = plan.segments.find((s) => s.key === 'acceleration');
    const plyo = plan.segments.find((s) => s.key === 'plyometric');
    expect(accel?.blocked).toBe(true);
    expect(plyo?.blocked).toBe(true);
  });

  it('builds a long-run + mobility-flow segment list for Saturday', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-10'); // Saturday, week 1
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'am' });
    expect(plan.segments[0]?.key).toBe('run');
    expect(plan.segments.length).toBeGreaterThan(1);
  });
});
