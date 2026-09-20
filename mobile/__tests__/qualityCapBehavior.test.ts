/**
 * Quality-cap movements (jumps/throws/sprints/plyo/brake work) end the set
 * on a quality drop, not a rep count — stopping early must never be
 * recorded or treated as a failure. This checks both halves: the plan
 * builder flags which exercises are quality-cap, and the repository lets a
 * quality-cap set be logged as 'partial' (fewer reps than prescribed)
 * without blocking the set, the exercise, or the overall session.
 */
import { buildSessionPlayerPlan } from '../src/features/workout/sessionPlanBuilder';
import { buildScheduledDay } from '../src/features/schedule/scheduleEngine';
import {
  completeSession,
  getOrCreateSession,
  listCompletedSetsForSession,
  upsertCompletedSet,
} from '../src/features/workout/workoutRepository';
import { generateId } from '../src/lib/offline/localWorkoutStore';

const userId = 'quality-cap-user';
const enrollmentId = 'quality-cap-enrollment';
const scheduleInput = { startDate: '2026-01-05', timezone: 'America/New_York' };

describe('quality-cap behavior', () => {
  it('flags Cluster A (POWER PRIMER) exercises as quality-cap in the plan', () => {
    const day = buildScheduledDay(scheduleInput, '2026-01-05'); // Monday Strength A, week 1
    const plan = buildSessionPlayerPlan({ scheduledDay: day, slot: 'pm' });
    const primerExercise = plan.exercises.find((e) => e.clusterId === 'A');
    expect(primerExercise?.qualityCap).toBe(true);
  });

  it('lets a quality-cap set stop early (fewer reps than prescribed) as "partial", not a failure', async () => {
    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-04-06',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 1,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });

    const set = await upsertCompletedSet({
      id: '',
      workoutSessionId: session.id,
      workoutExerciseId: 'exercise-quality-cap',
      userId,
      setNumber: 1,
      reps: 2, // prescribed was x3 — stopped early for quality
      qualityRating: 2,
      completionStatus: 'partial',
    });

    expect(set.completion_status).toBe('partial');

    // The set is still recorded (not discarded) and the session can still be completed normally.
    const sets = await listCompletedSetsForSession(userId, session.id);
    expect(sets).toHaveLength(1);

    const completed = await completeSession(userId, session.id, {
      durationActualSeconds: 1800,
      completionPct: 100,
    });
    expect(completed.status).toBe('completed');
  });
});
