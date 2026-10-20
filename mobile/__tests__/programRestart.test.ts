/**
 * Restart Program (src/lib/enrollment/enrollmentService.ts restartProgram).
 *
 * Demo mode runs the real local implementation end to end; Supabase mode
 * mocks the `restart_program` RPC (whose server-side atomicity, idempotency
 * and one-active-run guarantees are covered against real Postgres by
 * supabase/tests/db/10_program_restart.test.sql — `npm run test:db`).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- modules are required after env/mocks are set per test */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORIGINAL_ENV = process.env;
const userId = 'restart-user';

beforeEach(async () => {
  await AsyncStorage.clear();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  jest.resetModules();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('restartProgram — demo mode', () => {
  async function setup() {
    const store = require('../src/lib/demo/demoContentStore');
    const service = require('../src/lib/enrollment/enrollmentService');
    const repo = require('../src/features/workout/workoutRepository');
    const testing = require('../src/features/testing/testingRepository');
    const { generateId } = require('../src/lib/offline/localWorkoutStore');
    const original = await store.createDemoEnrollment(userId, {
      start_date: '2026-09-07',
      defer_week0_sprint_test: false,
    });
    return { store, service, repo, testing, generateId, original };
  }

  it('archives the current run and creates a new active run at Week 1, Day 1', async () => {
    const { service, original } = await setup();

    const next = await service.restartProgram(userId, original.id, '2026-10-26');

    expect(next).toMatchObject({
      status: 'active',
      startDate: '2026-10-26',
      restartedFromEnrollmentId: original.id,
      currentWeekOverride: null,
      restartAnchorDate: null,
    });
    expect(next.id).not.toBe(original.id);

    const current = await service.getCurrentEnrollmentForUser(userId);
    expect(current.id).toBe(next.id);

    const archived = await service.listArchivedEnrollmentsForUser(userId);
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({
      id: original.id,
      status: 'restarted',
      startDate: '2026-09-07',
    });
    expect(archived[0].archivedAt).toEqual(expect.any(String));
  });

  it('preserves the old run’s workouts, sets, testing results, check-ins and pause history', async () => {
    const { service, repo, testing, generateId, original } = await setup();

    const session = await repo.getOrCreateSession({
      id: generateId(),
      enrollmentId: original.id,
      userId,
      scheduledDate: '2026-09-07',
      sessionSlot: 'pm',
      sessionType: 'pm_strength_a',
      weekNumber: 1,
      dayOfWeek: 0,
      strengthLetter: 'A',
    });
    await repo.upsertCompletedSet({
      id: generateId(),
      workoutSessionId: session.id,
      workoutExerciseId: 'exercise-1',
      userId,
      setNumber: 1,
      weight: 225,
      weightUnit: 'lb',
      reps: 5,
    });
    const completed = await repo.completeSession(userId, session.id, {
      durationActualSeconds: 3000,
      completionPct: 100,
    });
    await repo.createReadinessEntry({
      userId,
      entryDate: '2026-09-07',
      sleepHours: 7.5,
      restingHr: 52,
      baselineRestingHr: 50,
      calfAchillesFlag: false,
      hamstringGrabbyFlag: false,
      jointPainFlag: false,
      jointPainLocation: null,
      readinessScore: 4,
      notes: null,
    });
    const tSession = await testing.getOrCreateTestingSession({
      userId,
      enrollmentId: original.id,
      eventKey: 'week0',
    });
    await testing.upsertTestingResult({
      userId,
      testingSessionId: tSession.id,
      markerNumber: 1,
      attemptNumber: 1,
      valueNumeric: 42,
    });
    await service.pauseEnrollment(userId, original.id, 'travel');
    await service.resumeEnrollment(userId, original.id);

    const before = {
      session: await repo.getSessionById(userId, session.id),
      sets: await repo.listCompletedSetsForSession(userId, session.id),
      readiness: await repo.getReadinessEntry(userId, '2026-09-07'),
      testing: await testing.listTestingResultsForSession(userId, tSession.id),
      pauses: await repo.listPauseEvents(userId, original.id),
    };

    const next = await service.restartProgram(userId, original.id, '2026-10-26');

    expect(await repo.getSessionById(userId, session.id)).toEqual(before.session);
    expect(before.session).toMatchObject({ status: 'completed', scheduled_date: '2026-09-07' });
    expect(completed.enrollment_id).toBe(original.id);
    expect(await repo.listCompletedSetsForSession(userId, session.id)).toEqual(before.sets);
    expect(before.sets).toHaveLength(1);
    expect(await repo.getReadinessEntry(userId, '2026-09-07')).toEqual(before.readiness);
    expect(await testing.listTestingResultsForSession(userId, tSession.id)).toEqual(before.testing);
    expect(before.testing).toHaveLength(1);
    expect(await repo.listPauseEvents(userId, original.id)).toEqual(before.pauses);
    expect(before.pauses).toHaveLength(1);

    // The new run starts clean.
    expect(
      await repo.listSessionsInRange(userId, next.id, '0000-01-01', '9999-12-31'),
    ).toHaveLength(0);
    expect(await testing.getTestingSession(userId, next.id, 'week0')).toBeNull();
  });

  it('archived sessions still resolve against their own run’s schedule', async () => {
    const { service, original } = await setup();
    await service.restartProgram(userId, original.id, '2026-10-26');

    const {
      fetchScheduleInputForEnrollment,
    } = require('../src/features/program/enrollmentScheduleInput');
    const { resolveDateContext } = require('../src/features/schedule/scheduleEngine');
    const oldInput = await fetchScheduleInputForEnrollment(userId, original.id);
    expect(oldInput.startDate).toBe('2026-09-07');
    // 2026-09-21 was Week 3 of the old run — not Week 0 of the new one.
    expect(resolveDateContext(oldInput, '2026-09-21').weekNumber).toBe(3);
  });

  it('duplicate taps (concurrent calls) create exactly one new run', async () => {
    const { service, store, original } = await setup();

    const results = await Promise.all([
      service.restartProgram(userId, original.id, '2026-10-26'),
      service.restartProgram(userId, original.id, '2026-10-26'),
      service.restartProgram(userId, original.id, '2026-10-26'),
    ]);

    expect(new Set(results.map((r: { id: string }) => r.id)).size).toBe(1);
    expect(await store.getDemoEnrollmentHistory(userId)).toHaveLength(1);
  });

  it('a retried restart after success returns the same run (idempotent)', async () => {
    const { service, store, original } = await setup();

    const first = await service.restartProgram(userId, original.id, '2026-10-26');
    const second = await service.restartProgram(userId, original.id, '2026-10-26');

    expect(second.id).toBe(first.id);
    expect(await store.getDemoEnrollmentHistory(userId)).toHaveLength(1);
  });

  it('only ever has one current run', async () => {
    const { service, original } = await setup();
    const first = await service.restartProgram(userId, original.id, '2026-10-26');
    const second = await service.restartProgram(userId, first.id, '2026-11-02');

    const archived = await service.listArchivedEnrollmentsForUser(userId);
    expect(archived.map((e: { id: string }) => e.id)).toEqual([first.id, original.id]);
    expect((await service.getCurrentEnrollmentForUser(userId)).id).toBe(second.id);

    // A stale retry for `first` (already restarted into `second`) returns `second`, never a third run.
    expect((await service.restartProgram(userId, first.id, '2026-11-09')).id).toBe(second.id);
    // The original run's replacement is itself archived — refused outright.
    await expect(service.restartProgram(userId, original.id, '2026-11-09')).rejects.toMatchObject({
      code: 'not_current',
    });
    expect((await service.getCurrentEnrollmentForUser(userId)).id).toBe(second.id);
    expect(await service.listArchivedEnrollmentsForUser(userId)).toHaveLength(2);
  });

  it('a paused run counts as the current run for routing (no re-onboarding)', async () => {
    const { service, original } = await setup();
    const { getEnrollmentStatus } = require('../src/lib/onboarding/onboardingService');
    await service.pauseEnrollment(userId, original.id, null);
    expect(await getEnrollmentStatus(userId)).toEqual({
      hasActiveEnrollment: true,
      startDate: '2026-09-07',
    });
  });
});

describe('restartProgram — Supabase mode', () => {
  function loadWithRpc(rpc: jest.Mock) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(40);
    jest.doMock('../src/lib/supabase/client', () => ({
      supabase: { rpc },
      requireSupabase: () => ({ rpc }),
    }));
    let service: typeof import('../src/lib/enrollment/enrollmentService');
    jest.isolateModules(() => {
      service = require('../src/lib/enrollment/enrollmentService');
    });
    return service!;
  }

  afterEach(() => jest.dontMock('../src/lib/supabase/client'));

  const row = {
    id: 'new-run',
    user_id: userId,
    program_version_id: 'pv',
    coach_id: null,
    start_date: '2026-10-26',
    status: 'active',
    current_week_override: null,
    restart_anchor_date: null,
    paused_at: null,
    restarted_from_enrollment_id: 'old-run',
    archived_at: null,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
  };

  it('calls the transactional restart_program RPC once for concurrent taps', async () => {
    let resolve!: (v: unknown) => void;
    const rpc = jest.fn(() => new Promise((r) => (resolve = r)));
    const service = loadWithRpc(rpc);

    const a = service.restartProgram(userId, 'old-run', '2026-10-26');
    const b = service.restartProgram(userId, 'old-run', '2026-10-26');
    resolve({ data: row, error: null });

    const [ra, rb] = await Promise.all([a, b]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('restart_program', {
      p_current_enrollment_id: 'old-run',
      p_new_start_date: '2026-10-26',
    });
    expect(ra).toEqual(rb);
    expect(ra).toMatchObject({ id: 'new-run', restartedFromEnrollmentId: 'old-run' });
  });

  it.each([
    [{ code: 'CCR04', message: 'This program run is no longer current' }, 'not_current'],
    [{ code: '23505', message: 'duplicate key value' }, 'not_current'],
    [{ code: 'CCR03', message: 'Program run not found' }, 'not_found'],
    [{ code: 'CCR02', message: 'Week 1 must start on a Monday' }, 'invalid_start_date'],
    [{ code: '', message: 'TypeError: Network request failed' }, 'network'],
  ])('maps server error %p to a useful %s error', async (error, code) => {
    const service = loadWithRpc(jest.fn().mockResolvedValue({ data: null, error }));
    await expect(service.restartProgram(userId, 'old-run', '2026-10-26')).rejects.toMatchObject({
      code,
    });
  });

  it('allows a retry after a failed attempt', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '', message: 'Network request failed' } })
      .mockResolvedValueOnce({ data: row, error: null });
    const service = loadWithRpc(rpc);

    await expect(service.restartProgram(userId, 'old-run', '2026-10-26')).rejects.toMatchObject({
      code: 'network',
    });
    await expect(service.restartProgram(userId, 'old-run', '2026-10-26')).resolves.toMatchObject({
      id: 'new-run',
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
