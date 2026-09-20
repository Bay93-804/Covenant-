/**
 * The load calculator must classify which tracked e1RM a strength day's
 * percentage prescriptions are a percentage of by reading that day's
 * authoritative `mainLift` field from the program JSON — never a
 * hard-coded per-letter (A/B/C/D) lookup, so a future edition that
 * reassigns which lift a letter uses (or renames a lift's exact wording)
 * keeps working with no code change. Approved mapping for this program
 * version: A -> trap-bar deadlift, B -> bench press, C -> back squat,
 * D -> no percentage-load calculator (its mainLift, "Kettlebell Swing",
 * matches none of the tracked lifts).
 */
import { resolveLiftKeyFromMainLift } from '../src/features/loadCalculator/resolveLiftKeyFromMainLift';
import { buildSessionPlayerPlan } from '../src/features/workout/sessionPlanBuilder';
import { buildScheduledDay, dateForWeekStart } from '../src/features/schedule/scheduleEngine';
import { addDays } from '../src/features/schedule/dateUtils';
import { getStrengthDayForWeek } from '../src/content/repository';

const scheduleInput = { startDate: '2026-01-05', timezone: 'America/New_York' };

describe('resolveLiftKeyFromMainLift: direct classification', () => {
  it('classifies every real mainLift wording used across Blocks 1-3 for Day A (Trap-Bar Deadlift)', () => {
    expect(resolveLiftKeyFromMainLift('Trap-Bar Deadlift')).toBe('trap_bar_deadlift');
  });

  it('classifies every real mainLift wording used across Blocks 1-3 for Day B (Bench Press)', () => {
    expect(resolveLiftKeyFromMainLift('DB Bench Press')).toBe('bench_press');
    expect(resolveLiftKeyFromMainLift('Bench Press')).toBe('bench_press');
  });

  it('classifies every real mainLift wording used across Blocks 1-3 for Day C (Squat)', () => {
    expect(resolveLiftKeyFromMainLift('Back or Goblet Squat')).toBe('back_squat');
    expect(resolveLiftKeyFromMainLift('Back Squat')).toBe('back_squat');
  });

  it('returns null for Day D (Kettlebell Swing) — no percentage-load calculator', () => {
    expect(resolveLiftKeyFromMainLift('Kettlebell Swing')).toBeNull();
  });

  it('returns null when mainLift is absent (null/undefined/empty)', () => {
    expect(resolveLiftKeyFromMainLift(null)).toBeNull();
    expect(resolveLiftKeyFromMainLift(undefined)).toBeNull();
    expect(resolveLiftKeyFromMainLift('')).toBeNull();
  });

  it('returns null for an unrecognized lift name rather than guessing', () => {
    expect(resolveLiftKeyFromMainLift('Sled Push')).toBeNull();
  });
});

describe('resolveLiftKeyFromMainLift: derived from the resolved program day, not a hard-coded letter map', () => {
  const letters = ['A', 'B', 'C', 'D'] as const;
  const expected: Record<(typeof letters)[number], string | null> = {
    A: 'trap_bar_deadlift',
    B: 'bench_press',
    C: 'back_squat',
    D: null,
  };

  it.each(letters)(
    'Day %s classifies consistently across all three blocks, reading each block’s own mainLift text',
    (letter) => {
      for (let block = 1; block <= 3; block++) {
        const week = (block - 1) * 4 + 1; // first week of each block
        const resolved = getStrengthDayForWeek(letter, week);
        expect(resolved).not.toBeNull();
        const liftKey = resolveLiftKeyFromMainLift(resolved!.dayBlock.mainLift);
        expect(liftKey).toBe(expected[letter]);
      }
    },
  );
});

describe('buildSessionPlayerPlan exposes mainLift end-to-end for the load calculator', () => {
  const week1Monday = dateForWeekStart(scheduleInput, 1);
  const week1Tuesday = addDays(week1Monday, 1);
  const week1Saturday = addDays(week1Monday, 5);

  it('Day A (Monday PM, week 1) plan carries "Trap-Bar Deadlift" as mainLift, resolving to trap_bar_deadlift', () => {
    const day = buildScheduledDay(scheduleInput, week1Monday);
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'pm' });
    expect(plan.strengthLetter).toBe('A');
    expect(plan.mainLift).toBe('Trap-Bar Deadlift');
    expect(resolveLiftKeyFromMainLift(plan.mainLift)).toBe('trap_bar_deadlift');
  });

  it('Day D (Saturday PM, week 1) plan carries a mainLift that resolves to no tracked lift key', () => {
    const day = buildScheduledDay(scheduleInput, week1Saturday);
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'pm' });
    expect(plan.strengthLetter).toBe('D');
    expect(plan.mainLift).toBe('Kettlebell Swing');
    expect(resolveLiftKeyFromMainLift(plan.mainLift)).toBeNull();
  });

  it('AM Tuesday Core/Balance/Brake (not a strength day) has no mainLift, so no load calculator applies', () => {
    const day = buildScheduledDay(scheduleInput, week1Tuesday);
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'am' });
    expect(plan.supportsPerSetLogging).toBe(true);
    expect(plan.mainLift).toBeNull();
    expect(resolveLiftKeyFromMainLift(plan.mainLift)).toBeNull();
  });
});
