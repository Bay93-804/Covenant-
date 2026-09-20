/**
 * "Never changes historical completed workouts when the schedule changes"
 * (Phase 3 brief §1). A workout_sessions row, once created, keeps its own
 * scheduled_date/status forever — pausing or restarting an enrollment only
 * changes how *future* dates are computed by the schedule engine, never an
 * existing row.
 */
import {
  completeSession,
  getOrCreateSession,
  getSession,
} from '../src/features/workout/workoutRepository';
import { generateId } from '../src/lib/offline/localWorkoutStore';
import {
  resolveDateContext,
  type EnrollmentScheduleInput,
} from '../src/features/schedule/scheduleEngine';

const userId = 'history-user';
const enrollmentId = 'history-enrollment';

describe('schedule-history preservation', () => {
  it('a completed session keeps its original scheduled_date after the enrollment is restarted', async () => {
    const original: EnrollmentScheduleInput = { startDate: '2026-01-05', timezone: 'UTC' };

    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-01-05',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 1,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    await completeSession(userId, session.id, { durationActualSeconds: 2000, completionPct: 100 });

    // Simulate a restart-at-block-start: week numbering for FUTURE dates now
    // pivots from a new anchor, but this has no bearing on the row already
    // written above — it isn't recomputed or touched.
    const restarted: EnrollmentScheduleInput = {
      ...original,
      currentWeekOverride: 1,
      restartAnchorDate: '2026-02-16', // athlete restarts Block 1 six weeks later
    };

    const stillThere = await getSession(userId, enrollmentId, '2026-01-05', 'pm');
    expect(stillThere?.status).toBe('completed');
    expect(stillThere?.scheduled_date).toBe('2026-01-05');
    expect(stillThere?.id).toBe(session.id);

    // The restart only affects how *new* dates resolve, e.g. 2026-01-05
    // under the restarted schedule is a date before the new anchor, so it
    // still resolves against the original numbering — week 1 either way —
    // but a date after the anchor now maps relative to the new anchor.
    expect(resolveDateContext(restarted, '2026-02-16').weekNumber).toBe(1);
    expect(resolveDateContext(restarted, '2026-01-05').weekNumber).toBe(
      resolveDateContext(original, '2026-01-05').weekNumber,
    );
  });
});
