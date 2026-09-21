import {
  completeTestingSession,
  getOrCreateTestingSession,
  getTestingSession,
  listTestingResultsForSession,
  startTestingSession,
  upsertTestingResult,
} from '../src/features/testing/testingRepository';

const userId = 'testing-user';
const enrollmentId = 'enrollment-1';

describe('testingRepository: sessions', () => {
  it('creates a testing session once per (enrollment, event) and never duplicates it', async () => {
    const first = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
      scheduledDate: '2026-01-01',
    });
    const second = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });
    expect(second.id).toBe(first.id);
  });

  it('resumes after a simulated app restart', async () => {
    const created = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week6',
    });
    const reloaded = await getTestingSession(userId, enrollmentId, 'week6');
    expect(reloaded?.id).toBe(created.id);
  });

  it('finalizing an already-completed session is a no-op (duplicate-submission guard)', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week12',
    });
    await startTestingSession(userId, session.id);
    const firstComplete = await completeTestingSession(userId, session.id);
    const secondComplete = await completeTestingSession(userId, session.id);
    expect(secondComplete.completed_at).toBe(firstComplete.completed_at);
  });
});

describe('testingRepository: results (autosave/resume, idempotency)', () => {
  it('resubmitting the same attempt updates in place rather than duplicating (duplicate-submission guard)', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });

    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 3,
      attemptNumber: 1,
      valueNumeric: 44,
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 3,
      attemptNumber: 1,
      valueNumeric: 46, // a correction, same attempt
    });

    const results = await listTestingResultsForSession(userId, session.id);
    const grip = results.filter((r) => r.marker_number === 3);
    expect(grip).toHaveLength(1);
    expect(grip[0]?.value_numeric).toBe(46);
  });

  it('preserves each attempt of a multi-attempt marker as its own row (raw attempts, not just the best)', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });

    for (const [attemptNumber, value] of [
      [1, 2.1],
      [2, 1.85],
      [3, 1.95],
    ] as const) {
      await upsertTestingResult({
        userId,
        testingSessionId: session.id,
        markerNumber: 11,
        attemptNumber,
        valueNumeric: value,
      });
    }

    const results = await listTestingResultsForSession(userId, session.id);
    const sprintAttempts = results.filter((r) => r.marker_number === 11);
    expect(sprintAttempts).toHaveLength(3);
    expect(sprintAttempts.map((a) => a.value_numeric).sort()).toEqual([1.85, 1.95, 2.1]);
  });

  it('autosave resumes correctly: a fresh query after a simulated restart reflects prior partial entry', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 8,
      attemptNumber: 1,
      valueNumeric: 30,
    });

    const restored = await listTestingResultsForSession(userId, session.id);
    expect(restored.find((r) => r.marker_number === 8)?.value_numeric).toBe(30);
  });

  it('distinguishes left and right sides at the same attempt number', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 9,
      attemptNumber: 1,
      side: 'left',
      valueNumeric: 90,
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 9,
      attemptNumber: 1,
      side: 'right',
      valueNumeric: 60,
    });

    const results = await listTestingResultsForSession(userId, session.id);
    const sidePlank = results.filter((r) => r.marker_number === 9);
    expect(sidePlank).toHaveLength(2);
  });
});
