import {
  buildScheduledDay,
  dateForWeekStart,
  datesForWeek,
  resolveDateContext,
  type EnrollmentScheduleInput,
} from '../src/features/schedule/scheduleEngine';
import {
  addDays,
  diffDays,
  isoDateInTimeZone,
  isoWeekdayIndex,
} from '../src/features/schedule/dateUtils';

const baseInput: EnrollmentScheduleInput = {
  startDate: '2026-01-05', // a Monday
  timezone: 'America/New_York',
};

describe('dateUtils', () => {
  it('adds and diffs days correctly across a month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(diffDays('2026-01-30', '2026-02-02')).toBe(3);
  });

  it('computes Monday=0..Sunday=6 weekday index', () => {
    expect(isoWeekdayIndex('2026-01-05')).toBe(0); // Monday
    expect(isoWeekdayIndex('2026-01-11')).toBe(6); // Sunday
  });

  it('resolves timezone boundaries: a date near midnight can differ by timezone', () => {
    // 2026-03-01 05:30 UTC is still Feb 28 in Los Angeles (UTC-8) but already Mar 1 in Tokyo (UTC+9).
    const instant = new Date('2026-03-01T05:30:00.000Z');
    expect(isoDateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-02-28');
    expect(isoDateInTimeZone(instant, 'Asia/Tokyo')).toBe('2026-03-01');
  });

  it('falls back to local date on an invalid timezone rather than throwing', () => {
    expect(() => isoDateInTimeZone(new Date('2026-01-01T00:00:00Z'), 'Not/AZone')).not.toThrow();
  });
});

describe('resolveDateContext', () => {
  it('treats any date before the start date as Week 0', () => {
    const result = resolveDateContext(baseInput, '2026-01-01');
    expect(result.weekNumber).toBe(0);
    expect(result.isBeforeProgramStart).toBe(true);
  });

  it('maps the start date itself to Week 1, day 0 (Monday)', () => {
    const result = resolveDateContext(baseInput, '2026-01-05');
    expect(result.weekNumber).toBe(1);
    expect(result.dayOfWeek).toBe(0);
  });

  it('maps exactly 7 days later to Week 2', () => {
    const result = resolveDateContext(baseInput, '2026-01-12');
    expect(result.weekNumber).toBe(2);
  });

  it('caps at Week 12 for dates far beyond the program', () => {
    const result = resolveDateContext(baseInput, '2026-06-01');
    expect(result.weekNumber).toBe(12);
  });

  it('excludes paused days from week progression', () => {
    // Pause for 7 full days starting the Monday of week 2 (2026-01-12).
    const input: EnrollmentScheduleInput = {
      ...baseInput,
      pauseEvents: [
        { pausedAt: '2026-01-12T00:00:00.000Z', resumedAt: '2026-01-19T00:00:00.000Z' },
      ],
    };
    // Without the pause, 2026-01-26 would be week 4; with 7 paused days it should still be week 3.
    const result = resolveDateContext(input, '2026-01-26');
    expect(result.weekNumber).toBe(3);
  });

  it('honors a block-restart anchor: resets week numbering from a later date', () => {
    const input: EnrollmentScheduleInput = {
      ...baseInput,
      currentWeekOverride: 5,
      restartAnchorDate: '2026-03-02', // a Monday, restarting at Block 2 (week 5)
    };
    expect(resolveDateContext(input, '2026-03-02').weekNumber).toBe(5);
    expect(resolveDateContext(input, '2026-03-09').weekNumber).toBe(6);
    // Dates before the restart anchor still resolve against the original numbering.
    expect(resolveDateContext(input, '2026-01-05').weekNumber).toBe(1);
  });
});

describe('buildScheduledDay', () => {
  it('marks Monday AM as a readiness-gated speed/plyo session and PM as Strength A', () => {
    const day = buildScheduledDay(baseInput, '2026-01-05');
    expect(day.am.sessionType).toBe('am_speed_plyo');
    expect(day.am.requiresReadinessCheck).toBe(true);
    expect(day.pm.sessionType).toBe('pm_strength_a');
    expect(day.pm.strengthLetter).toBe('A');
    expect(day.pm.requiresReadinessCheck).toBe(true);
  });

  it('marks Tuesday AM (core/balance/brake) as not requiring the readiness gate', () => {
    const day = buildScheduledDay(baseInput, '2026-01-06');
    expect(day.am.sessionType).toBe('am_core_balance_brake');
    expect(day.am.requiresReadinessCheck).toBe(false);
  });

  it('marks Wednesday as a full rest day', () => {
    const day = buildScheduledDay(baseInput, '2026-01-07');
    expect(day.am.isRestDay).toBe(true);
    expect(day.pm.isRestDay).toBe(true);
  });

  it('identifies deload weeks (week 4 = end of Block 1)', () => {
    const day = buildScheduledDay(baseInput, dateForWeekStart(baseInput, 4));
    expect(day.weekContext.isDeload).toBe(true);
  });

  it('identifies the Week 6 retest week and Week 12 taper/test week', () => {
    const week6 = buildScheduledDay(baseInput, dateForWeekStart(baseInput, 6));
    expect(week6.weekContext.isRetest).toBe(true);
    const week12 = buildScheduledDay(baseInput, dateForWeekStart(baseInput, 12));
    expect(week12.weekContext.isTaperAndTest).toBe(true);
  });
});

describe('datesForWeek / dateForWeekStart', () => {
  it('returns 7 consecutive dates starting on the week Monday', () => {
    const dates = datesForWeek(baseInput, 3);
    expect(dates).toHaveLength(7);
    expect(isoWeekdayIndex(dates[0]!)).toBe(0);
    expect(dates[0]).toBe(dateForWeekStart(baseInput, 3));
  });

  it('shifts subsequent weeks forward by paused time', () => {
    const input: EnrollmentScheduleInput = {
      ...baseInput,
      pauseEvents: [
        { pausedAt: '2026-01-12T00:00:00.000Z', resumedAt: '2026-01-19T00:00:00.000Z' },
      ],
    };
    const withoutPause = dateForWeekStart(baseInput, 4);
    const withPause = dateForWeekStart(input, 4);
    expect(diffDays(withoutPause, withPause)).toBe(7);
  });
});
