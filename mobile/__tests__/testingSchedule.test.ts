import {
  buildTestingWindows,
  computeTestingWindowState,
} from '../src/features/testing/testingSchedule';
import type { EnrollmentScheduleInput } from '../src/features/schedule/scheduleEngine';

const baseInput: EnrollmentScheduleInput = {
  startDate: '2026-01-05', // a Monday
  timezone: 'America/New_York',
};

describe('buildTestingWindows', () => {
  it('Week 0 window ends the day before Week 1 Monday and covers all 15 markers', () => {
    const windows = buildTestingWindows(baseInput);
    expect(windows.week0.windowEnd).toBe('2026-01-04');
    expect(windows.week0.markers).toHaveLength(15);
    expect(windows.week0.markers).toEqual(expect.arrayContaining([1, 7, 11, 15]));
  });

  it('Week 6 window is exactly the Wednesday of week 6 and carries exactly 6 markers', () => {
    const windows = buildTestingWindows(baseInput);
    // Week 1 Monday is 2026-01-05, so week 6 Monday is 2026-02-09, Wednesday is 2026-02-11.
    expect(windows.week6.windowStart).toBe('2026-02-11');
    expect(windows.week6.windowEnd).toBe('2026-02-11');
    expect(windows.week6.markers).toEqual([1, 4, 5, 9, 12, 15]);
    expect(windows.week6.markers).not.toContain(11);
    expect(windows.week6.markers).not.toContain(2); // never a full 15-marker retest
  });

  it('Week 12 window spans the full week and covers all 15 markers', () => {
    const windows = buildTestingWindows(baseInput);
    expect(windows.week12.markers).toHaveLength(15);
    // Week 12 Monday is 11 weeks after week 1 Monday.
    expect(windows.week12.windowStart).toBe('2026-03-23');
    expect(windows.week12.windowEnd).toBe('2026-03-29');
  });
});

describe('computeTestingWindowState', () => {
  const windows = buildTestingWindows(baseInput);

  it('is "upcoming" before the window opens', () => {
    const state = computeTestingWindowState(windows.week6, '2026-01-01', null);
    expect(state).toBe('upcoming');
  });

  it('is "available" inside the window with no session started', () => {
    const state = computeTestingWindowState(windows.week6, '2026-02-11', null);
    expect(state).toBe('available');
  });

  it('is "in_progress" once started but not completed', () => {
    const state = computeTestingWindowState(windows.week0, '2026-01-02', {
      startedAt: '2026-01-01T10:00:00.000Z',
      completedAt: null,
    });
    expect(state).toBe('in_progress');
  });

  it('is "completed" once finalized, regardless of date', () => {
    const state = computeTestingWindowState(windows.week0, '2026-05-01', {
      startedAt: '2026-01-01T10:00:00.000Z',
      completedAt: '2026-01-03T10:00:00.000Z',
    });
    expect(state).toBe('completed');
  });

  it('is "missed" once the window has closed with nothing started — but never blocks re-entry', () => {
    const state = computeTestingWindowState(windows.week0, '2026-01-10', null);
    expect(state).toBe('missed');
  });

  it('Week 0 is always "available" immediately, however far out Week 1 is scheduled', () => {
    const farOutInput: EnrollmentScheduleInput = { startDate: '2027-06-07', timezone: 'UTC' };
    const farWindows = buildTestingWindows(farOutInput);
    const state = computeTestingWindowState(farWindows.week0, '2026-01-05', null);
    expect(state).toBe('available');
  });
});
