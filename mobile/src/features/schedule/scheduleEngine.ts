/**
 * Deterministic schedule engine.
 *
 * Turns an enrollment (Week 1 start date + pause history + any block-restart
 * anchor) into a concrete, date-mapped calendar: which absolute program week
 * and day-of-week corresponds to which real calendar date, in the athlete's
 * own timezone, for Week 0 (baseline testing) through Week 12.
 *
 * This module never reads or writes `workout_sessions` rows — it is pure
 * content + enrollment-instance math. A `workout_sessions` row, once it
 * exists, is the durable historical record of what actually happened on a
 * date; this engine only ever answers "what does the *plan* say for this
 * date", which is exactly what's needed to materialize a session row the
 * first time a day is opened, and to render the Program calendar's
 * "upcoming" cells that don't have a row yet. Changing the schedule (pause,
 * resume, restart) never edits or deletes an existing `workout_sessions`
 * row — see docs/phase1/DATABASE_SCHEMA.md principle #2.
 */
import {
  getStrengthDayForWeek,
  getWeeklySpeedPlanForWeek,
  getWeeklyTemplateDay,
  resolveWeekContext,
  type DayOfWeekIndex,
  type StrengthDayLetter,
  type WeekContext,
} from '../../content/repository';
import { DEFAULT_PROGRAM_VERSION_SLUG, type ProgramVersionSlug } from '../../content/source';
import { addDays, diffDays, isoWeekdayIndex, type IsoDate } from './dateUtils';

export type SessionSlotKey = 'am' | 'pm';

export type ScheduleSessionType =
  | 'am_speed_plyo'
  | 'am_core_balance_brake'
  | 'am_tempo_agility'
  | 'am_long_run'
  | 'am_rest'
  | 'pm_strength_a'
  | 'pm_strength_b'
  | 'pm_strength_c'
  | 'pm_strength_d'
  | 'pm_rest';

const AM_REF_TO_SESSION_TYPE: Record<string, ScheduleSessionType> = {
  mondaySpeedPlyo: 'am_speed_plyo',
  tuesdayCoreBalanceBrake: 'am_core_balance_brake',
  'weeklySpeedPlan.thuAm': 'am_tempo_agility',
  'weeklySpeedPlan.satAm': 'am_long_run',
};

const PM_REF_TO_SESSION_TYPE: Record<string, ScheduleSessionType> = {
  strengthA: 'pm_strength_a',
  strengthB: 'pm_strength_b',
  strengthC: 'pm_strength_c',
  strengthD: 'pm_strength_d',
};

const PM_REF_TO_STRENGTH_LETTER: Record<string, StrengthDayLetter> = {
  strengthA: 'A',
  strengthB: 'B',
  strengthC: 'C',
  strengthD: 'D',
};

/** Speed, plyometric, and strength sessions require the readiness/safety gate. Core/balance/brake and long-run days do not. */
const READINESS_REQUIRED_SESSION_TYPES = new Set<ScheduleSessionType>([
  'am_speed_plyo',
  'am_tempo_agility',
  'pm_strength_a',
  'pm_strength_b',
  'pm_strength_c',
  'pm_strength_d',
]);

export interface ScheduledSession {
  slot: SessionSlotKey;
  sessionType: ScheduleSessionType;
  title: string;
  minutesLow: number | null;
  minutesHigh: number | null;
  isRestDay: boolean;
  requiresReadinessCheck: boolean;
  strengthLetter: StrengthDayLetter | null;
}

export interface ScheduledDay {
  date: IsoDate;
  weekNumber: number;
  /** 0=Monday .. 6=Sunday. */
  dayOfWeek: DayOfWeekIndex;
  dayLabel: string;
  weekContext: WeekContext;
  isWeek0: boolean;
  am: ScheduledSession;
  pm: ScheduledSession;
}

export interface PauseEvent {
  pausedAt: string; // ISO datetime
  resumedAt: string | null; // ISO datetime, null while still paused
}

export interface EnrollmentScheduleInput {
  /** Week 1's Monday, `YYYY-MM-DD`. */
  startDate: IsoDate;
  timezone: string;
  /** Set only after a restart-at-block-start; the week number "restartAnchorDate" begins counting from. */
  currentWeekOverride?: number | null;
  /** Calendar date (a Monday) that `currentWeekOverride`'s week begins counting from. */
  restartAnchorDate?: IsoDate | null;
  pauseEvents?: PauseEvent[];
}

function pauseDaysBefore(pauseEvents: PauseEvent[], onOrBeforeIso: IsoDate): number {
  let total = 0;
  const cutoff = `${onOrBeforeIso}T23:59:59.999Z`;
  for (const event of pauseEvents) {
    const pausedAt = event.pausedAt;
    const resumedAt = event.resumedAt ?? cutoff;
    const effectiveEnd = resumedAt < cutoff ? resumedAt : cutoff;
    if (effectiveEnd <= pausedAt) continue;
    const days = Math.floor(
      (new Date(effectiveEnd).getTime() - new Date(pausedAt).getTime()) / 86_400_000,
    );
    total += Math.max(0, days);
  }
  return total;
}

/**
 * Resolves the absolute program week number and day-of-week for a given
 * calendar date, accounting for pause time (which doesn't count toward
 * program progress) and any block-restart anchor (which re-bases week
 * numbering from a later date without touching Week 0's original
 * `startDate`, since Week 0's baseline-testing window is always measured
 * from the very first start date, never a restart).
 */
export function resolveDateContext(
  input: EnrollmentScheduleInput,
  dateIso: IsoDate,
): { weekNumber: number; dayOfWeek: DayOfWeekIndex; isBeforeProgramStart: boolean } {
  const pauseEvents = input.pauseEvents ?? [];
  const dayOfWeek = isoWeekdayIndex(dateIso) as DayOfWeekIndex;

  if (dateIso < input.startDate) {
    return { weekNumber: 0, dayOfWeek, isBeforeProgramStart: true };
  }

  const anchorDate = input.restartAnchorDate ?? input.startDate;
  const anchorWeek = input.currentWeekOverride ?? 1;

  if (dateIso < anchorDate) {
    // Between original start and a later restart anchor: still resolve
    // against the original, pre-restart numbering so calendar review of
    // that already-elapsed time doesn't warp.
    const rawElapsed = diffDays(input.startDate, dateIso);
    const pausedDays = pauseDaysBefore(pauseEvents, dateIso);
    const adjustedElapsed = Math.max(0, rawElapsed - pausedDays);
    const weekNumber = Math.min(12, Math.floor(adjustedElapsed / 7) + 1);
    return { weekNumber, dayOfWeek, isBeforeProgramStart: false };
  }

  const rawElapsed = diffDays(anchorDate, dateIso);
  const pausedDays = pauseDaysBefore(
    pauseEvents.filter((e) => e.pausedAt >= `${anchorDate}T00:00:00.000Z`),
    dateIso,
  );
  const adjustedElapsed = Math.max(0, rawElapsed - pausedDays);
  const weekNumber = Math.min(12, anchorWeek + Math.floor(adjustedElapsed / 7));
  return { weekNumber, dayOfWeek, isBeforeProgramStart: false };
}

function buildSession(
  slot: SessionSlotKey,
  weekNumber: number,
  ref: string | undefined,
  label: string,
  minutesLow: number | null,
  minutesHigh: number | null,
  slug: ProgramVersionSlug,
): ScheduledSession {
  if (!ref) {
    return {
      slot,
      sessionType: slot === 'am' ? 'am_rest' : 'pm_rest',
      title: label,
      minutesLow: null,
      minutesHigh: null,
      isRestDay: true,
      requiresReadinessCheck: false,
      strengthLetter: null,
    };
  }

  if (slot === 'am') {
    const sessionType = AM_REF_TO_SESSION_TYPE[ref] ?? 'am_rest';
    let resolvedMinutesLow = minutesLow;
    let resolvedMinutesHigh = minutesHigh;
    if (ref === 'weeklySpeedPlan.satAm') {
      const speedPlan = getWeeklySpeedPlanForWeek(weekNumber, slug);
      resolvedMinutesLow = speedPlan?.satAmMinutes ?? null;
      resolvedMinutesHigh = speedPlan?.satAmMinutes ?? null;
    }
    return {
      slot,
      sessionType,
      title: label,
      minutesLow: resolvedMinutesLow,
      minutesHigh: resolvedMinutesHigh,
      isRestDay: false,
      requiresReadinessCheck: READINESS_REQUIRED_SESSION_TYPES.has(sessionType),
      strengthLetter: null,
    };
  }

  const sessionType = PM_REF_TO_SESSION_TYPE[ref] ?? 'pm_rest';
  const strengthLetter = PM_REF_TO_STRENGTH_LETTER[ref] ?? null;
  return {
    slot,
    sessionType,
    title: label,
    minutesLow,
    minutesHigh,
    isRestDay: false,
    requiresReadinessCheck: READINESS_REQUIRED_SESSION_TYPES.has(sessionType),
    strengthLetter,
  };
}

/** Builds the full scheduled-day plan for a single calendar date. */
export function buildScheduledDay(
  input: EnrollmentScheduleInput,
  dateIso: IsoDate,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): ScheduledDay {
  const { weekNumber, dayOfWeek } = resolveDateContext(input, dateIso);
  const template = getWeeklyTemplateDay(dayOfWeek, slug);
  const weekContext = resolveWeekContext(weekNumber, slug);

  return {
    date: dateIso,
    weekNumber,
    dayOfWeek,
    dayLabel: template.day,
    weekContext,
    isWeek0: weekNumber === 0,
    am: buildSession(
      'am',
      weekNumber,
      template.am.ref,
      template.am.label,
      template.am.minutes?.[0] ?? null,
      template.am.minutes?.[1] ?? null,
      slug,
    ),
    pm: buildSession(
      'pm',
      weekNumber,
      template.pm.ref,
      template.pm.label,
      template.pm.minutes?.[0] ?? null,
      template.pm.minutes?.[1] ?? null,
      slug,
    ),
  };
}

/** Builds scheduled days for every date in `[fromIso, toIso]`, inclusive. */
export function buildScheduleRange(
  input: EnrollmentScheduleInput,
  fromIso: IsoDate,
  toIso: IsoDate,
  slug: ProgramVersionSlug = DEFAULT_PROGRAM_VERSION_SLUG,
): ScheduledDay[] {
  const days: ScheduledDay[] = [];
  let cursor = fromIso;
  // Safety cap: never loop more than ~2 years of days even if given a bad range.
  for (let i = 0; i < 730 && cursor <= toIso; i++) {
    days.push(buildScheduledDay(input, cursor, slug));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Returns the first calendar date (a Monday) of a given absolute week number
 * (1-12), or the Week-0 start date for week 0. Since pause windows shift the
 * date->week mapping forward by a variable number of days, this inverts
 * `resolveDateContext` by fixed-point iteration (it's monotonic in date, so
 * this converges in at most a couple of passes bounded by total paused
 * time) rather than trying to invert the pause-days math directly.
 */
export function dateForWeekStart(input: EnrollmentScheduleInput, weekNumber: number): IsoDate {
  if (weekNumber <= 0) return input.startDate;
  const anchorDate = input.restartAnchorDate ?? input.startDate;
  const anchorWeek = input.currentWeekOverride ?? 1;
  let guess = addDays(anchorDate, (weekNumber - anchorWeek) * 7);

  for (let i = 0; i < 20; i++) {
    const resolved = resolveDateContext(input, guess);
    const deltaWeeks = weekNumber - resolved.weekNumber;
    if (deltaWeeks === 0) break;
    guess = addDays(guess, deltaWeeks * 7);
  }
  // Snap back to that week's Monday.
  const weekday = isoWeekdayIndex(guess);
  return addDays(guess, -weekday);
}

/** All 7 calendar dates (Mon-Sun) for an absolute week number. */
export function datesForWeek(input: EnrollmentScheduleInput, weekNumber: number): IsoDate[] {
  const start = dateForWeekStart(input, weekNumber);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
