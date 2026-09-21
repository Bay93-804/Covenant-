import {
  getOrCreateTestingSession,
  listTestingResultsForSession,
  upsertTestingResult,
} from '../src/features/testing/testingRepository';
import {
  getSprintDeferral,
  hasCompletedSprintAttempt,
  isSprintDeferralRow,
  recordSprintDeferral,
} from '../src/features/testing/sprintDeferral';

const userId = 'sprint-user';
const enrollmentId = 'sprint-enrollment';

describe('sprintDeferral', () => {
  it('records a deferral with a reason and date, retrievable afterward', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId,
      eventKey: 'week0',
    });
    await recordSprintDeferral({
      userId,
      testingSessionId: session.id,
      reason: "Haven't sprinted at full effort since my twenties",
      deferredDate: '2026-01-02',
    });

    const deferral = await getSprintDeferral(userId, session.id);
    expect(deferral?.reason).toContain('twenties');
    expect(deferral?.deferredDate).toBe('2026-01-02');
  });

  it('marker #12-15 are unaffected by a marker #11 deferral (only #11 is deferred)', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId: enrollmentId + '-2',
      eventKey: 'week0',
    });
    await recordSprintDeferral({
      userId,
      testingSessionId: session.id,
      reason: 'Not ready yet',
      deferredDate: '2026-01-02',
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 12,
      attemptNumber: 1,
      valueNumeric: 90,
    });

    const results = await listTestingResultsForSession(userId, session.id);
    const broadJump = results.find((r) => r.marker_number === 12);
    expect(broadJump?.value_numeric).toBe(90);
    expect(results.filter(isSprintDeferralRow)).toHaveLength(1);
  });

  it('a completed real sprint attempt is recognized as such, distinct from a deferral', async () => {
    const session = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId: enrollmentId + '-3',
      eventKey: 'week6',
    });
    await upsertTestingResult({
      userId,
      testingSessionId: session.id,
      markerNumber: 11,
      attemptNumber: 1,
      valueNumeric: 1.9,
    });
    const results = await listTestingResultsForSession(userId, session.id);
    expect(hasCompletedSprintAttempt(results)).toBe(true);
  });
});
