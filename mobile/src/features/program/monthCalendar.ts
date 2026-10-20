/**
 * Pure month-calendar + agenda logic for the Program tab's calendar.
 *
 * Like src/features/schedule/dateUtils.ts, everything here works on
 * `YYYY-MM-DD` strings and UTC-epoch day math only — never a local-time
 * `Date` — so a workout can't slide to a neighboring day when the device's
 * timezone or DST offset changes. The only wall-clock input is "today",
 * which callers resolve once with `todayIso(deviceTimeZone)`.
 */
import { addDays, diffDays, type IsoDate } from '../schedule/dateUtils';
import type { ScheduledSession } from '../schedule/scheduleEngine';
import type { TestingEventKey, TestingWindow } from '../testing/testingSchedule';
import type { DayCalendarEntry, DayCalendarState } from './useProgramCalendar';

export interface MonthRef {
  year: number;
  /** 1-12 */
  month: number;
}

/** 0 = Sunday-first grid (the default), 1 = Monday-first. */
export type WeekStart = 0 | 1;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function monthOf(iso: IsoDate): MonthRef {
  const [y, m] = iso.split('-').map(Number);
  return { year: y ?? 1970, month: m ?? 1 };
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isSameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

export function firstOfMonth(ref: MonthRef): IsoDate {
  return `${ref.year}-${pad2(ref.month)}-01`;
}

export function daysInMonth(ref: MonthRef): number {
  return diffDays(firstOfMonth(ref), firstOfMonth(addMonths(ref, 1)));
}

/** 0=Sunday..6=Saturday for a calendar date, independent of device timezone. */
export function sundayWeekdayIndex(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthLabel(ref: MonthRef): string {
  return `${MONTH_NAMES[ref.month - 1]} ${ref.year}`;
}

/** e.g. "Monday, October 26" (or with the year when `withYear`). */
export function formatLongDate(iso: IsoDate, withYear = false): string {
  const { year, month } = monthOf(iso);
  const day = Number(iso.slice(8, 10));
  const base = `${WEEKDAY_NAMES[sundayWeekdayIndex(iso)]}, ${MONTH_NAMES[month - 1]} ${day}`;
  return withYear ? `${base}, ${year}` : base;
}

export function weekdayHeaders(weekStart: WeekStart = 0): string[] {
  const short = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return weekStart === 0 ? short : [...short.slice(1), short[0]!];
}

/**
 * Every cell of a month grid, row-major, padded with `null` before the 1st
 * and after the last day so each row has 7 cells. 4–6 rows depending on
 * the month.
 */
export function buildMonthGrid(ref: MonthRef, weekStart: WeekStart = 0): (IsoDate | null)[][] {
  const first = firstOfMonth(ref);
  const leading = (sundayWeekdayIndex(first) - weekStart + 7) % 7;
  const count = daysInMonth(ref);
  const cells: (IsoDate | null)[] = Array.from({ length: leading }, () => null);
  for (let i = 0; i < count; i++) cells.push(addDays(first, i));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ---------------------------------------------------------------------------
// Day status (calendar cell markers)
// ---------------------------------------------------------------------------

export type DayStatus =
  | 'scheduled'
  | 'completed'
  | 'in_progress'
  | 'missed'
  | 'rest'
  /** Outside the current run's Week 1–12. */
  | 'none';

export interface DayMarker {
  status: DayStatus;
  isTesting: boolean;
}

function trainingStates(entry: DayCalendarEntry): DayCalendarState[] {
  const states: DayCalendarState[] = [];
  if (!entry.scheduledDay.am.isRestDay) states.push(entry.amState);
  if (!entry.scheduledDay.pm.isRestDay) states.push(entry.pmState);
  return states;
}

export function dayStatus(entry: DayCalendarEntry | undefined): DayStatus {
  if (!entry) return 'none';
  const states = trainingStates(entry);
  if (states.length === 0) return 'rest';
  if (states.every((s) => s === 'completed')) return 'completed';
  if (states.some((s) => s === 'in_progress')) return 'in_progress';
  // Any past training slot left undone makes the day missed/incomplete,
  // even when the other slot was completed.
  if (states.some((s) => s === 'missed')) return 'missed';
  return 'scheduled';
}

export interface TestingDay {
  eventKey: TestingEventKey;
  label: string;
}

/**
 * Calendar dates that belong to a testing event for the current run. Week 0
 * has no fixed start (see testingSchedule.ts), so it's shown on the days
 * between the run's creation and Week 1 — capped to the 7 days before Week 1.
 */
export function testingDaysByDate(
  windows: Record<TestingEventKey, TestingWindow>,
  week1StartDate: IsoDate,
  runCreatedOn: IsoDate | null,
): Map<IsoDate, TestingDay> {
  const result = new Map<IsoDate, TestingDay>();

  const week0End = addDays(week1StartDate, -1);
  let week0Start = addDays(week1StartDate, -7);
  if (runCreatedOn && runCreatedOn > week0Start) week0Start = runCreatedOn;
  for (let d = week0Start; d <= week0End; d = addDays(d, 1)) {
    result.set(d, { eventKey: 'week0', label: windows.week0.label });
  }

  for (const key of ['week6', 'week12'] as const) {
    const window = windows[key];
    for (let d = window.windowStart; d <= window.windowEnd; d = addDays(d, 1)) {
      result.set(d, { eventKey: key, label: window.label });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export type AgendaAction =
  | { kind: 'review'; sessionId: string }
  | { kind: 'resume'; sessionId: string }
  | { kind: 'start_today' }
  | { kind: 'view_day'; date: IsoDate }
  | { kind: 'open_testing' };

export interface AgendaWorkoutItem {
  type: 'workout';
  key: string;
  slot: 'am' | 'pm';
  title: string;
  weekNumber: number;
  /** 1 = Monday ... 7 = Sunday, matching the program's Mon-start weeks. */
  dayNumber: number;
  durationLabel: string | null;
  state: DayCalendarState;
  adjusted: boolean;
  action: AgendaAction;
  actionLabel: string;
}

export interface AgendaTestingItem {
  type: 'testing';
  key: string;
  title: string;
  eventKey: TestingEventKey;
  action: AgendaAction;
  actionLabel: string;
}

export interface AgendaRestItem {
  type: 'rest';
  key: string;
  title: string;
  /** The program's own rest-day guidance, e.g. "OFF — walk 20-30 min if you want". */
  note: string;
  weekNumber: number;
  dayNumber: number;
}

export type AgendaItem = AgendaWorkoutItem | AgendaTestingItem | AgendaRestItem;

export function durationLabel(
  session: Pick<ScheduledSession, 'minutesLow' | 'minutesHigh'>,
): string | null {
  const { minutesLow: low, minutesHigh: high } = session;
  if (!low && !high) return null;
  if (low && high && low !== high) return `${low}–${high} min`;
  return `${low ?? high} min`;
}

function workoutAction(
  state: DayCalendarState,
  sessionId: string | undefined,
  date: IsoDate,
): { action: AgendaAction; actionLabel: string } {
  if (state === 'completed' && sessionId) {
    return { action: { kind: 'review', sessionId }, actionLabel: 'Review' };
  }
  if (state === 'in_progress' && sessionId) {
    return { action: { kind: 'resume', sessionId }, actionLabel: 'Resume' };
  }
  if (state === 'today') return { action: { kind: 'start_today' }, actionLabel: 'Start' };
  return { action: { kind: 'view_day', date }, actionLabel: 'Details' };
}

export function buildAgenda(
  date: IsoDate,
  entry: DayCalendarEntry | undefined,
  testingDay: TestingDay | undefined,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  if (testingDay) {
    items.push({
      type: 'testing',
      key: `testing:${testingDay.eventKey}`,
      title: testingDay.label,
      eventKey: testingDay.eventKey,
      action: { kind: 'open_testing' },
      actionLabel: 'Open Testing',
    });
  }

  if (!entry) return items;

  const { scheduledDay } = entry;
  const dayNumber = scheduledDay.dayOfWeek + 1;
  const slots = [
    {
      slot: 'am' as const,
      session: scheduledDay.am,
      state: entry.amState,
      row: entry.amSession,
      adjusted: entry.amAdjusted,
    },
    {
      slot: 'pm' as const,
      session: scheduledDay.pm,
      state: entry.pmState,
      row: entry.pmSession,
      adjusted: entry.pmAdjusted,
    },
  ];

  const training = slots.filter((s) => !s.session.isRestDay);
  if (training.length === 0) {
    items.push({
      type: 'rest',
      key: 'rest',
      title: 'Rest day',
      note: scheduledDay.am.title,
      weekNumber: scheduledDay.weekNumber,
      dayNumber,
    });
    return items;
  }

  for (const s of training) {
    items.push({
      type: 'workout',
      key: `${date}:${s.slot}`,
      slot: s.slot,
      title: s.session.title,
      weekNumber: scheduledDay.weekNumber,
      dayNumber,
      durationLabel: durationLabel(s.session),
      state: s.state,
      adjusted: s.adjusted,
      ...workoutAction(s.state, s.row?.id, date),
    });
  }
  return items;
}
