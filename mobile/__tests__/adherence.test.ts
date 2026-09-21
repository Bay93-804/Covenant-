import { computeProgramAdherence } from '../src/features/progress/adherence';
import type { EnrollmentScheduleInput } from '../src/features/schedule/scheduleEngine';
import type { WorkoutSession } from '../src/features/workout/types';

const baseInput: EnrollmentScheduleInput = {
  startDate: '2026-01-05', // a Monday
  timezone: 'UTC',
};

function session(
  scheduledDate: string,
  slot: 'am' | 'pm',
  status: WorkoutSession['status'],
): WorkoutSession {
  return {
    id: `${scheduledDate}-${slot}`,
    client_uuid: `${scheduledDate}-${slot}`,
    enrollment_id: 'enrollment-1',
    user_id: 'user-1',
    program_day_id: 'day-1',
    workout_template_id: 'template-1',
    scheduled_date: scheduledDate,
    session_slot: slot,
    status,
    readiness_entry_id: null,
    started_at: null,
    completed_at:
      status === 'completed' || status === 'adjusted' ? `${scheduledDate}T12:00:00Z` : null,
    duration_actual_seconds: null,
    completion_pct: null,
    abandoned: false,
    synced_at: null,
    created_at: `${scheduledDate}T06:00:00Z`,
    updated_at: `${scheduledDate}T06:00:00Z`,
  };
}

describe('computeProgramAdherence', () => {
  it('computes weekly and overall adherence honestly, without projecting future weeks', () => {
    const sessions: WorkoutSession[] = [
      // Week 1 (Mon 2026-01-05 .. Sun 2026-01-11), fully elapsed by "today".
      session('2026-01-05', 'am', 'completed'),
      session('2026-01-05', 'pm', 'completed'),
      session('2026-01-06', 'am', 'completed'),
      session('2026-01-06', 'pm', 'adjusted'),
      session('2026-01-10', 'am', 'completed'),
      session('2026-01-10', 'pm', 'completed'),
      // Thursday 2026-01-08 AM/PM intentionally not logged -> counted missed.

      // Week 2 (Mon 2026-01-12 .. Sun 2026-01-18), partial as of "today".
      session('2026-01-12', 'am', 'completed'),
      // 2026-01-12 PM intentionally not logged -> missed (day is in the past).
    ];

    const todayIso = '2026-01-13'; // Tuesday of week 2 — week 2's Tue/Thu/Sat haven't happened yet.
    const result = computeProgramAdherence(baseInput, todayIso, sessions);

    const week1 = result.weeks.find((w) => w.weekNumber === 1)!;
    expect(week1.hasStarted).toBe(true);
    expect(week1.hasFullyElapsed).toBe(true);
    expect(week1.scheduledSessionCount).toBe(8); // 4 training days x 2 sessions
    expect(week1.completedCount).toBe(5);
    expect(week1.adjustedCount).toBe(1);
    expect(week1.missedCount).toBe(2); // Thursday AM + PM
    expect(week1.completionPct).toBeCloseTo(75);

    const week2 = result.weeks.find((w) => w.weekNumber === 2)!;
    expect(week2.hasStarted).toBe(true);
    expect(week2.hasFullyElapsed).toBe(false);
    expect(week2.completedCount).toBe(1);
    expect(week2.missedCount).toBe(1); // Monday PM only — today itself is never "missed"

    const week3 = result.weeks.find((w) => w.weekNumber === 3)!;
    expect(week3.hasStarted).toBe(false);
    expect(week3.scheduledSessionCount).toBe(0);
    expect(week3.completionPct).toBe(0); // "not yet reached", not a fabricated 0% failure

    expect(result.currentWeek).toBe(2);
    expect(result.totalScheduled).toBe(16); // only weeks that have started
    expect(result.totalCompleted).toBe(6);
    expect(result.totalAdjusted).toBe(1);
    expect(result.totalMissed).toBe(3);
    expect(result.overallAdherencePct).toBeCloseTo(((6 + 1) / 16) * 100);
  });

  it('reports zero adherence honestly (not a crash) when nothing has been logged yet', () => {
    const result = computeProgramAdherence(baseInput, '2026-01-05', []);
    expect(result.overallAdherencePct).toBe(0);
    expect(result.totalCompleted).toBe(0);
  });

  it('never counts scheduled sessions for a week that has not started yet', () => {
    const result = computeProgramAdherence(baseInput, '2026-01-01', []); // before Week 1 begins
    expect(result.totalScheduled).toBe(0);
    expect(result.weeks.every((w) => !w.hasStarted)).toBe(true);
  });
});
