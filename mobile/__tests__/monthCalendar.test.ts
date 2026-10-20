/**
 * Program calendar (src/features/program/monthCalendar.ts): month grid,
 * 12-week date mapping across month/year/DST boundaries, timezone-safe
 * "today", cell status, and agenda actions.
 */
import {
  addMonths,
  buildAgenda,
  buildMonthGrid,
  dayStatus,
  daysInMonth,
  formatLongDate,
  monthOf,
  testingDaysByDate,
} from '../src/features/program/monthCalendar';
import type {
  DayCalendarEntry,
  DayCalendarState,
} from '../src/features/program/useProgramCalendar';
import { addDays, nextMondayOnOrAfter, todayIso } from '../src/features/schedule/dateUtils';
import {
  buildScheduledDay,
  datesForWeek,
  type EnrollmentScheduleInput,
} from '../src/features/schedule/scheduleEngine';
import { buildTestingWindows } from '../src/features/testing/testingSchedule';
import type { WorkoutSession } from '../src/features/workout/types';

describe('month grid', () => {
  it('starts on Sunday and pads to whole weeks', () => {
    // October 2026 starts on a Thursday.
    const rows = buildMonthGrid({ year: 2026, month: 10 });
    expect(rows[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(rows.flat().filter(Boolean)).toHaveLength(31);
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows.at(-1)!.at(-1)).toBe('2026-10-31'); // a Saturday — no trailing blanks
  });

  it('handles month and year boundaries', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, 14)).toEqual({ year: 2028, month: 1 });
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29); // leap year
    expect(daysInMonth({ year: 2027, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);

    const jan = buildMonthGrid({ year: 2027, month: 1 }).flat();
    expect(jan.find(Boolean)).toBe('2027-01-01');
    expect(jan.filter(Boolean).at(-1)).toBe('2027-01-31');
  });

  it('a month that starts on Sunday has no leading blanks', () => {
    // February 2026 starts on Sunday and has exactly 4 weeks.
    const rows = buildMonthGrid({ year: 2026, month: 2 });
    expect(rows).toHaveLength(4);
    expect(rows[0]![0]).toBe('2026-02-01');
  });

  it('formats dates without depending on the device timezone', () => {
    expect(formatLongDate('2026-10-26')).toBe('Monday, October 26');
    expect(formatLongDate('2027-01-01', true)).toBe('Friday, January 1, 2027');
  });
});

describe('12-week mapping from the enrollment start date', () => {
  it('maps every program week to consecutive real dates across a year boundary', () => {
    const input: EnrollmentScheduleInput = {
      startDate: '2026-11-30',
      timezone: 'America/New_York',
    };
    const all = Array.from({ length: 12 }, (_, i) => datesForWeek(input, i + 1)).flat();

    expect(all).toHaveLength(84);
    expect(all[0]).toBe('2026-11-30'); // Week 1, Day 1 (Monday)
    expect(all.at(-1)).toBe('2027-02-21'); // Week 12, Day 7 (Sunday)
    for (let i = 1; i < all.length; i++) expect(all[i]).toBe(addDays(all[i - 1]!, 1));

    // Week 5 straddles New Year's Eve.
    expect(datesForWeek(input, 5)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(buildScheduledDay(input, '2027-01-01')).toMatchObject({ weekNumber: 5, dayOfWeek: 4 });
  });

  it('is unaffected by a DST change inside the program', () => {
    // US DST begins 2027-03-14; the clock change must not drop or repeat a day.
    const input: EnrollmentScheduleInput = {
      startDate: '2027-03-01',
      timezone: 'America/Los_Angeles',
    };
    expect(datesForWeek(input, 2)).toEqual([
      '2027-03-08',
      '2027-03-09',
      '2027-03-10',
      '2027-03-11',
      '2027-03-12',
      '2027-03-13',
      '2027-03-14',
    ]);
    expect(buildScheduledDay(input, '2027-03-15')).toMatchObject({ weekNumber: 3, dayOfWeek: 0 });
  });

  it('a restart picks the next Monday on or after today for Week 1, Day 1', () => {
    expect(nextMondayOnOrAfter('2026-10-20')).toBe('2026-10-26'); // Tuesday -> next Monday
    expect(nextMondayOnOrAfter('2026-10-26')).toBe('2026-10-26'); // Monday -> same day
    expect(nextMondayOnOrAfter('2026-12-29')).toBe('2027-01-04'); // across the year
  });
});

describe('timezone-safe day selection', () => {
  // 03:30 UTC on Jan 1 2027 is still Dec 31 in Los Angeles but Jan 1 in Tokyo.
  const instant = new Date('2027-01-01T03:30:00Z');

  it('resolves "today" in the device timezone, not UTC', () => {
    expect(todayIso('America/Los_Angeles', instant)).toBe('2026-12-31');
    expect(todayIso('Asia/Tokyo', instant)).toBe('2027-01-01');
    expect(todayIso('UTC', instant)).toBe('2027-01-01');
    expect(todayIso('Pacific/Kiritimati', new Date('2026-12-31T10:30:00Z'))).toBe('2027-01-01');
  });

  it('opens the calendar on the month that contains local today', () => {
    expect(monthOf(todayIso('America/Los_Angeles', instant))).toEqual({ year: 2026, month: 12 });
    expect(monthOf(todayIso('Asia/Tokyo', instant))).toEqual({ year: 2027, month: 1 });
  });

  it('selecting a date returns that date’s sessions regardless of device timezone', () => {
    const input: EnrollmentScheduleInput = { startDate: '2026-11-30', timezone: 'Asia/Tokyo' };
    const day = buildScheduledDay(input, '2026-12-31');
    const sameDayElsewhere = buildScheduledDay(
      { ...input, timezone: 'America/Los_Angeles' },
      '2026-12-31',
    );
    expect(day.date).toBe('2026-12-31');
    expect(sameDayElsewhere).toEqual({ ...day });
  });
});

function entry(
  date: string,
  amState: DayCalendarState,
  pmState: DayCalendarState,
  sessions: { am?: Partial<WorkoutSession>; pm?: Partial<WorkoutSession> } = {},
): DayCalendarEntry {
  const scheduledDay = buildScheduledDay({ startDate: '2026-10-26', timezone: 'UTC' }, date);
  return {
    scheduledDay,
    amSession: (sessions.am as WorkoutSession) ?? null,
    pmSession: (sessions.pm as WorkoutSession) ?? null,
    amState: scheduledDay.am.isRestDay ? 'rest' : amState,
    pmState: scheduledDay.pm.isRestDay ? 'rest' : pmState,
    amAdjusted: false,
    pmAdjusted: false,
  };
}

describe('day status markers', () => {
  // 2026-10-26 is Week 1 Monday: AM speed/plyo + PM Strength A.
  it('classifies completed, missed/incomplete, in-progress, scheduled and none', () => {
    expect(dayStatus(entry('2026-10-26', 'completed', 'completed'))).toBe('completed');
    expect(dayStatus(entry('2026-10-26', 'completed', 'missed'))).toBe('missed');
    expect(dayStatus(entry('2026-10-26', 'missed', 'missed'))).toBe('missed');
    expect(dayStatus(entry('2026-10-26', 'in_progress', 'today'))).toBe('in_progress');
    expect(dayStatus(entry('2026-10-26', 'upcoming', 'upcoming'))).toBe('scheduled');
    expect(dayStatus(entry('2026-10-26', 'today', 'today'))).toBe('scheduled');
    expect(dayStatus(undefined)).toBe('none');
  });

  it('a day with no training slots is a rest day', () => {
    // Wednesday, Friday and Sunday are full rest days in the program.
    for (const date of ['2026-10-28', '2026-10-30', '2026-11-01']) {
      expect(dayStatus(entry(date, 'upcoming', 'upcoming'))).toBe('rest');
      expect(buildAgenda(date, entry(date, 'upcoming', 'upcoming'), undefined)).toEqual([
        expect.objectContaining({
          type: 'rest',
          weekNumber: 1,
          note: expect.stringMatching(/^OFF/),
        }),
      ]);
    }
  });

  it('marks Week 0, Week 6 and Week 12 testing days', () => {
    const input: EnrollmentScheduleInput = { startDate: '2026-10-26', timezone: 'UTC' };
    const days = testingDaysByDate(buildTestingWindows(input), input.startDate, '2026-10-22');

    expect(days.get('2026-10-21')).toBeUndefined(); // before the run existed
    expect(days.get('2026-10-22')?.eventKey).toBe('week0');
    expect(days.get('2026-10-25')?.eventKey).toBe('week0');
    expect(days.get('2026-10-26')).toBeUndefined(); // Week 1, Day 1 is training
    const week6Wednesday = datesForWeek(input, 6)[2]!;
    expect(days.get(week6Wednesday)?.eventKey).toBe('week6');
    for (const d of datesForWeek(input, 12)) expect(days.get(d)?.eventKey).toBe('week12');
  });
});

describe('agenda', () => {
  it('shows title, week/day, duration and the right action for each state', () => {
    const today = buildAgenda('2026-10-26', entry('2026-10-26', 'today', 'today'), undefined);
    expect(today).toHaveLength(2);
    expect(today[0]).toMatchObject({
      type: 'workout',
      slot: 'am',
      weekNumber: 1,
      dayNumber: 1,
      action: { kind: 'start_today' },
      actionLabel: 'Start',
    });
    expect((today[1] as { title: string }).title).toEqual(expect.any(String));

    const done = buildAgenda(
      '2026-10-26',
      entry('2026-10-26', 'completed', 'in_progress', { am: { id: 's-am' }, pm: { id: 's-pm' } }),
      undefined,
    );
    expect(done[0]).toMatchObject({
      action: { kind: 'review', sessionId: 's-am' },
      actionLabel: 'Review',
    });
    expect(done[1]).toMatchObject({
      action: { kind: 'resume', sessionId: 's-pm' },
      actionLabel: 'Resume',
    });

    const missed = buildAgenda('2026-10-26', entry('2026-10-26', 'missed', 'upcoming'), undefined);
    expect(missed[0]).toMatchObject({
      state: 'missed',
      action: { kind: 'view_day', date: '2026-10-26' },
    });
  });

  it('includes estimated duration when the program provides one', () => {
    const items = buildAgenda('2026-10-26', entry('2026-10-26', 'upcoming', 'upcoming'), undefined);
    const withDuration = items.filter((i) => i.type === 'workout' && i.durationLabel);
    expect(withDuration.length).toBeGreaterThan(0);
    for (const i of withDuration) {
      expect((i as { durationLabel: string }).durationLabel).toMatch(/^\d+(–\d+)? min$/);
    }
  });

  it('puts the testing event first on testing days, and is empty outside the run', () => {
    const items = buildAgenda('2026-10-24', undefined, { eventKey: 'week0', label: 'Week 0' });
    expect(items).toEqual([
      expect.objectContaining({ type: 'testing', action: { kind: 'open_testing' } }),
    ]);
    expect(buildAgenda('2027-06-01', undefined, undefined)).toEqual([]);
  });
});
