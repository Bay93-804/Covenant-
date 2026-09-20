import {
  completeSession,
  getOrCreateSession,
  getSession,
  createReadinessEntry,
  listCompletedSetsForSession,
  listReadinessHistory,
  upsertCompletedSet,
} from '../src/features/workout/workoutRepository';
import { strengthWorkoutExerciseId } from '../src/content/contentIds';
import { generateId } from '../src/lib/offline/localWorkoutStore';

const userId = 'user-1';
const enrollmentId = 'enrollment-1';

describe('workoutRepository: sessions', () => {
  it('getOrCreateSession creates a session once and returns the same row on a second call', async () => {
    const first = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-02-02',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 1,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    const second = await getOrCreateSession({
      id: generateId(), // a different client id — must not create a second row
      enrollmentId,
      userId,
      scheduledDate: '2026-02-02',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 1,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    expect(second.id).toBe(first.id);
    expect(first.status).toBe('scheduled');
  });

  it('refuses to create a session row for a rest day', async () => {
    await expect(
      getOrCreateSession({
        id: generateId(),
        enrollmentId,
        userId,
        scheduledDate: '2026-02-04',
        sessionSlot: 'am',
        sessionType: 'am_rest',
        weekNumber: 1,
        dayOfWeek: 2,
      }),
    ).rejects.toThrow();
  });

  it('completeSession is idempotent — completing an already-completed session is a no-op', async () => {
    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-02-09',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 2,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    const firstComplete = await completeSession(userId, session.id, {
      durationActualSeconds: 2400,
      completionPct: 100,
    });
    const secondComplete = await completeSession(userId, session.id, {
      durationActualSeconds: 9999, // if this "won", it would prove the guard failed
      completionPct: 50,
    });
    expect(secondComplete.completed_at).toBe(firstComplete.completed_at);
    expect(secondComplete.duration_actual_seconds).toBe(2400);
  });

  it('restores a session after a simulated app restart (a fresh read reflects the prior write)', async () => {
    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-02-16',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 3,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    // Simulate "app restart": no in-memory state is reused, just re-query the store fresh.
    const restored = await getSession(userId, enrollmentId, '2026-02-16', 'pm');
    expect(restored?.id).toBe(session.id);
    expect(restored?.status).toBe('scheduled');
  });
});

describe('workoutRepository: completed sets', () => {
  it('prevents duplicate set submissions: resubmitting the same set updates in place', async () => {
    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-02-23',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 4,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    const workoutExerciseId = strengthWorkoutExerciseId('A', 4, 'A1');

    await upsertCompletedSet({
      id: '',
      workoutSessionId: session.id,
      workoutExerciseId,
      userId,
      setNumber: 1,
      reps: 8,
      weight: 135,
    });
    // Retry with different data — this must UPDATE the same row, not add a second one.
    await upsertCompletedSet({
      id: '',
      workoutSessionId: session.id,
      workoutExerciseId,
      userId,
      setNumber: 1,
      reps: 8,
      weight: 140,
    });

    const sets = await listCompletedSetsForSession(userId, session.id);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.weight).toBe(140);
  });

  it('tracks left/right sets separately at the same set number', async () => {
    const session = await getOrCreateSession({
      id: generateId(),
      enrollmentId,
      userId,
      scheduledDate: '2026-03-02',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 5,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    const workoutExerciseId = strengthWorkoutExerciseId('A', 5, 'A2');

    await upsertCompletedSet({
      id: '',
      workoutSessionId: session.id,
      workoutExerciseId,
      userId,
      setNumber: 1,
      side: 'left',
      reps: 8,
    });
    await upsertCompletedSet({
      id: '',
      workoutSessionId: session.id,
      workoutExerciseId,
      userId,
      setNumber: 1,
      side: 'right',
      reps: 8,
    });

    const sets = await listCompletedSetsForSession(userId, session.id);
    expect(sets).toHaveLength(2);
  });
});

describe('workoutRepository: readiness entries', () => {
  it('keeps exactly one readiness entry per athlete per day, updating on resubmission', async () => {
    await createReadinessEntry({
      id: '',
      userId,
      entryDate: '2026-03-10',
      sleepHours: 7,
      restingHr: 52,
      baselineRestingHr: 50,
      calfAchillesFlag: false,
      hamstringGrabbyFlag: false,
      jointPainFlag: false,
      readinessScore: 4,
    });
    await createReadinessEntry({
      id: '',
      userId,
      entryDate: '2026-03-10',
      sleepHours: 5.5, // corrected later the same morning
      restingHr: 52,
      baselineRestingHr: 50,
      calfAchillesFlag: false,
      hamstringGrabbyFlag: false,
      jointPainFlag: false,
      readinessScore: 3,
    });

    const history = await listReadinessHistory(userId, '2026-03-10', '2026-03-10');
    expect(history).toHaveLength(1);
    expect(history[0]?.sleep_hours).toBe(5.5);
  });
});
