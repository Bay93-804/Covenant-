import { getOrCreateTestingSession } from '../src/features/testing/testingRepository';
import {
  computeEstablishedRhr,
  computeRhrProgress,
  listRhrReadings,
  recordRhrReading,
  RhrDuplicateMorningError,
} from '../src/features/testing/rhrWorkflow';

const userId = 'rhr-user';
const enrollmentId = 'rhr-enrollment';

async function freshSession(eventKey: 'week0' | 'week6' | 'week12' = 'week0') {
  return getOrCreateTestingSession({
    id: '',
    userId,
    enrollmentId: enrollmentId + eventKey,
    eventKey,
  });
}

describe('rhrWorkflow: three-morning baseline', () => {
  it('tracks 1-of-3, 2-of-3, 3-of-3 progress as mornings are logged', async () => {
    const session = await freshSession();
    expect(computeRhrProgress(await listRhrReadings(userId, session.id))).toMatchObject({
      completed: 0,
      isComplete: false,
    });

    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-01-01',
      bpm: 58,
    });
    expect(computeRhrProgress(await listRhrReadings(userId, session.id))).toMatchObject({
      completed: 1,
    });

    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-01-02',
      bpm: 56,
    });
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-01-03',
      bpm: 60,
    });

    const readings = await listRhrReadings(userId, session.id);
    const progress = computeRhrProgress(readings);
    expect(progress).toMatchObject({ completed: 3, required: 3, isComplete: true });
  });

  it('computes the established baseline only once 3 mornings exist, never from 1 or 2', async () => {
    const session = await freshSession('week6');
    let readings = await listRhrReadings(userId, session.id);
    expect(computeEstablishedRhr(readings)).toBeNull();

    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-02-11',
      bpm: 60,
    });
    readings = await listRhrReadings(userId, session.id);
    expect(computeEstablishedRhr(readings)).toBeNull(); // single reading is not a baseline

    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-02-12',
      bpm: 62,
    });
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-02-13',
      bpm: 58,
    });
    readings = await listRhrReadings(userId, session.id);
    const established = computeEstablishedRhr(readings);
    expect(established?.bpm).toBeCloseTo(60); // (60+62+58)/3
    expect(established?.bpmDisplay).toBe(60);
    expect(established?.morningsUsed).toEqual(['2026-02-11', '2026-02-12', '2026-02-13']);
  });

  it('keeps full-precision bpm distinct from the 1-decimal display value: internal comparisons must use bpm, never bpmDisplay', async () => {
    const session = await freshSession('week12');
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-05-01',
      bpm: 60,
    });
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-05-02',
      bpm: 61,
    });
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-05-03',
      bpm: 63,
    });

    const readings = await listRhrReadings(userId, session.id);
    const established = computeEstablishedRhr(readings);
    // (60+61+63)/3 = 61.333... — never pre-rounded internally.
    expect(established?.bpm).toBeCloseTo(61.3333333, 5);
    expect(established?.bpm).not.toBe(61.3);
    // Display is rounded to exactly one decimal place.
    expect(established?.bpmDisplay).toBe(61.3);
  });

  it('prevents the same morning from being unintentionally entered twice', async () => {
    const session = await freshSession('week12');
    await recordRhrReading({
      userId,
      testingSessionId: session.id,
      morningDate: '2026-03-23',
      bpm: 55,
    });

    await expect(
      recordRhrReading({
        userId,
        testingSessionId: session.id,
        morningDate: '2026-03-23',
        bpm: 70,
      }),
    ).rejects.toThrow(RhrDuplicateMorningError);

    // The original reading must be untouched after the rejected duplicate.
    const readings = await listRhrReadings(userId, session.id);
    expect(readings.find((r) => r.morningDate === '2026-03-23')?.bpm).toBe(55);
  });

  it('allows an explicit, audit-friendly correction for the same morning', async () => {
    const enrollment2 = enrollmentId + '-correction';
    const correctionSession = await getOrCreateTestingSession({
      id: '',
      userId,
      enrollmentId: enrollment2,
      eventKey: 'week0',
    });
    await recordRhrReading({
      userId,
      testingSessionId: correctionSession.id,
      morningDate: '2026-04-01',
      bpm: 58,
    });
    const corrected = await recordRhrReading({
      userId,
      testingSessionId: correctionSession.id,
      morningDate: '2026-04-01',
      bpm: 61,
      allowCorrection: true,
    });
    expect(corrected.bpm).toBe(61);
    expect(corrected.notes).toContain('Corrected');

    const readings = await listRhrReadings(userId, correctionSession.id);
    expect(readings.find((r) => r.morningDate === '2026-04-01')?.bpm).toBe(61);
  });
});
