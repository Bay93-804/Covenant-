import {
  buildExerciseHistory,
  type NamedCompletedSet,
} from '../src/features/progress/exerciseHistory';

function set(overrides: Partial<NamedCompletedSet>): NamedCompletedSet {
  return {
    exerciseName: 'Trap-Bar Deadlift',
    sessionId: 'session-1',
    scheduledDate: '2026-01-05',
    weekNumber: 1,
    setNumber: 1,
    side: null,
    weight: null,
    weightUnit: null,
    reps: null,
    actualRir: null,
    timeSeconds: null,
    distance: null,
    distanceUnit: null,
    sprintTime: null,
    completionStatus: 'completed',
    ...overrides,
  };
}

describe('buildExerciseHistory', () => {
  it('groups sets by exercise name across weeks and detects the heaviest weight as a personal best', () => {
    const sets: NamedCompletedSet[] = [
      set({
        sessionId: 's1',
        scheduledDate: '2026-01-05',
        weekNumber: 1,
        weight: 135,
        weightUnit: 'lb',
        reps: 8,
      }),
      set({
        sessionId: 's2',
        scheduledDate: '2026-01-12',
        weekNumber: 2,
        weight: 145,
        weightUnit: 'lb',
        reps: 8,
      }),
      set({
        sessionId: 's3',
        scheduledDate: '2026-01-19',
        weekNumber: 3,
        weight: 140,
        weightUnit: 'lb',
        reps: 8,
      }),
    ];
    const history = buildExerciseHistory(sets);
    expect(history).toHaveLength(1);
    expect(history[0]?.bestWeight).toMatchObject({ value: 145, weekNumber: 2 });
    expect(history[0]?.totalSetsLogged).toBe(3);
  });

  it('never fabricates a best from a missing value — only compares logged values', () => {
    const sets: NamedCompletedSet[] = [
      set({ weight: null, reps: 8 }), // bodyweight set, no weight logged
      set({ weight: 100, reps: null }), // weight logged, reps not
    ];
    const history = buildExerciseHistory(sets);
    expect(history[0]?.bestWeight?.value).toBe(100); // only the one set that logged weight
    expect(history[0]?.bestReps?.value).toBe(8); // only the one set that logged reps
  });

  it('computes reps as the highest single-set rep count when weight is absent', () => {
    const sets: NamedCompletedSet[] = [
      set({ weight: null, reps: 12 }),
      set({ weight: null, reps: 15 }),
    ];
    const history = buildExerciseHistory(sets);
    expect(history[0]?.bestReps?.value).toBe(15);
  });

  it('treats sprint time as lower-is-better and hold time as higher-is-better', () => {
    const sets: NamedCompletedSet[] = [
      set({ exerciseName: 'Sprint Drill', sprintTime: 1.9 }),
      set({ exerciseName: 'Sprint Drill', sprintTime: 1.75 }),
      set({ exerciseName: 'Plank', timeSeconds: 45 }),
      set({ exerciseName: 'Plank', timeSeconds: 60 }),
    ];
    const history = buildExerciseHistory(sets);
    const sprint = history.find((e) => e.name === 'Sprint Drill')!;
    const plank = history.find((e) => e.name === 'Plank')!;
    expect(sprint.bestSprintTime?.value).toBe(1.75);
    expect(plank.bestHoldSeconds?.value).toBe(60);
  });

  it('excludes skipped sets from history and personal-best detection', () => {
    const sets: NamedCompletedSet[] = [
      set({ weight: 200, reps: 5, completionStatus: 'skipped' }),
      set({ weight: 150, reps: 5, completionStatus: 'completed' }),
    ];
    const history = buildExerciseHistory(sets);
    expect(history[0]?.bestWeight?.value).toBe(150);
  });

  it('computes session volume only from sets that logged both weight and reps', () => {
    const sets: NamedCompletedSet[] = [
      set({ sessionId: 's1', scheduledDate: '2026-01-05', weekNumber: 1, weight: 100, reps: 5 }),
      set({ sessionId: 's1', scheduledDate: '2026-01-05', weekNumber: 1, weight: null, reps: 5 }), // no weight — excluded
      set({
        sessionId: 's2',
        scheduledDate: '2026-01-12',
        weekNumber: 2,
        weight: null,
        reps: null,
      }),
    ];
    const history = buildExerciseHistory(sets);
    const volumes = history[0]!.volumeBySession;
    expect(volumes.find((v) => v.date === '2026-01-05')?.totalVolume).toBe(500);
    expect(volumes.find((v) => v.date === '2026-01-12')?.totalVolume).toBeNull();
  });
});
