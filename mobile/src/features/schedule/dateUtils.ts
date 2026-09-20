/**
 * Small, dependency-free date utilities used by the schedule engine.
 *
 * Every function here operates on plain `YYYY-MM-DD` calendar-date strings
 * (never `Date` objects carrying a timezone/time-of-day) so that "today" and
 * "the athlete's Week 1 Monday" compare unambiguously regardless of what
 * timezone the device happens to be in when the code runs. The one place a
 * `Date`/timezone actually matters — turning "right now, in the athlete's
 * timezone" into a `YYYY-MM-DD` string — is `isoDateInTimeZone`, which is
 * also the only function that takes a IANA timezone name.
 */

export type IsoDate = string; // 'YYYY-MM-DD'

const MS_PER_DAY = 86_400_000;

/** Parses a `YYYY-MM-DD` string into a UTC-midnight epoch-ms value, safe for day-diffing. */
function toEpochDay(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const epochDay = toEpochDay(iso) + days;
  const date = new Date(epochDay * MS_PER_DAY);
  return date.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function diffDays(fromIso: IsoDate, toIso: IsoDate): number {
  return toEpochDay(toIso) - toEpochDay(fromIso);
}

/** 0=Monday .. 6=Sunday, matching `program_days.day_of_week` in the DB schema. */
export function isoWeekdayIndex(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function isMonday(iso: IsoDate): boolean {
  return isoWeekdayIndex(iso) === 0;
}

/**
 * Renders "now" as a `YYYY-MM-DD` string in a given IANA timezone. This is
 * the one place wall-clock/timezone conversion happens — everything else in
 * the schedule engine works with the resulting calendar-date strings, which
 * is what preserves "the user's timezone" (PRD requirement) without every
 * downstream function needing to know what timezone it is.
 */
export function isoDateInTimeZone(date: Date, timeZone: string): IsoDate {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA formats as YYYY-MM-DD already.
    return formatter.format(date);
  } catch {
    // Invalid/unsupported timeZone identifier — fall back to the device's
    // local calendar date rather than throwing, since a bad profile.timezone
    // value must never crash the Today screen.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function todayIso(timeZone: string, now: Date = new Date()): IsoDate {
  return isoDateInTimeZone(now, timeZone);
}
