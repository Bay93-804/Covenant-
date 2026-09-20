/**
 * Week 1 Start Date scheduling helpers.
 *
 * See docs/phase1/EXTRACTION_AUDIT.md #10 (RESOLVED) — the source program
 * never specifies a start weekday, so this is an app scheduling/UX
 * decision, not a change to the program content:
 *   - Week 1 must begin on a Monday.
 *   - The onboarding field defaults to the first Monday at least
 *     `MIN_RECOMMENDED_LEAD_DAYS` days out, so the athlete has time to
 *     complete Week 0 baseline testing first.
 *   - The athlete may still pick an earlier upcoming Monday — the app
 *     warns, it never blocks or silently overrides the choice.
 *
 * Every function here uses **local-time** `Date` getters/setters
 * (`getFullYear`/`getMonth`/`getDate`/`getDay`/`setDate`, never
 * `toISOString` or any UTC variant) so "today" and "Monday" are always
 * computed in the athlete's own device timezone, not UTC.
 */

/** Days of lead time recommended before Week 1 starts, so Week 0 (three RHR mornings + a separate fresh Athletic Five day + the remaining baseline markers) has room to happen first. */
export const MIN_RECOMMENDED_LEAD_DAYS = 7;

function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** The next Monday on/after `date` (returns `date` itself if it's already a Monday), in local time. */
export function nextMondayOnOrAfter(date: Date): Date {
  const result = startOfLocalDay(date);
  const daysUntilMonday = (8 - result.getDay()) % 7; // getDay(): 0=Sun..6=Sat
  result.setDate(result.getDate() + daysUntilMonday);
  return result;
}

/** Formats a Date as `YYYY-MM-DD` using local date parts — never `toISOString()`, which is UTC and can shift the calendar day near midnight in timezones ahead of/behind UTC. */
export function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The earliest Monday the athlete may select at all: the next upcoming Monday from today (local time), which may be less than a week away. */
export function getEarliestSelectableMonday(now: Date = new Date()): Date {
  return nextMondayOnOrAfter(startOfLocalDay(now));
}

/**
 * The recommended default Week 1 Start Date: the first Monday that is at
 * least `MIN_RECOMMENDED_LEAD_DAYS` days from today (local time), giving
 * the athlete time to complete Week 0 baseline testing first.
 */
export function getDefaultWeek1StartDate(now: Date = new Date()): Date {
  const earliestAllowedDay = startOfLocalDay(now);
  earliestAllowedDay.setDate(earliestAllowedDay.getDate() + MIN_RECOMMENDED_LEAD_DAYS);
  return nextMondayOnOrAfter(earliestAllowedDay);
}

/**
 * True when `iso` (a `YYYY-MM-DD` Week 1 Start Date, assumed already
 * Monday-valid) falls before the recommended default — i.e. the athlete
 * has chosen to compress their Week 0 baseline-testing window. Used to
 * decide whether to show the Week 0 completeness warning, never to block
 * the choice.
 */
export function isEarlierThanRecommended(iso: string, now: Date = new Date()): boolean {
  const chosen = new Date(`${iso}T00:00:00`);
  const recommended = getDefaultWeek1StartDate(now);
  return chosen.getTime() < recommended.getTime();
}
