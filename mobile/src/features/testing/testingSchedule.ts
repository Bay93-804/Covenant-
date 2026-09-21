/**
 * Deterministic Week 0 / Week 6 / Week 12 testing windows, derived from the
 * same enrollment schedule input the workout schedule engine uses (Week 1
 * start date, pause history, restart anchor — see
 * src/features/schedule/scheduleEngine.ts) plus the authoritative
 * `testing.events` content (src/content/repository.ts's `getTestingEvent`).
 *
 * This module never reads or writes `testing_sessions`/`testing_results` —
 * exactly like the workout schedule engine, it only answers "what does the
 * plan say", so the same date math (timezone-safe, Monday-based Week 1
 * start) drives both workout and testing scheduling without duplicating it.
 */
import { getTestingEvent } from '../../content/repository';
import type { IsoDate } from '../schedule/dateUtils';
import { datesForWeek, type EnrollmentScheduleInput } from '../schedule/scheduleEngine';

export type TestingEventKey = 'week0' | 'week6' | 'week12';

export type TestingWindowState =
  'upcoming' | 'available' | 'in_progress' | 'completed' | 'deferred' | 'missed';

export interface TestingWindow {
  eventKey: TestingEventKey;
  label: string;
  /** All markers this event covers, per the authoritative program content — 15 for Week 0/12, 6 for Week 6. */
  markers: number[];
  /** First calendar date this window is meant to be worked on. */
  windowStart: IsoDate;
  /** Last calendar date this window is "on schedule" — entry is still always possible after this date, it is simply labeled late rather than blocked (never a hard lock, per the product's "never silently overwrite/block history" principle). */
  windowEnd: IsoDate;
}

/**
 * Week 0 has no PDF-specified start day (see docs/phase1/EXTRACTION_AUDIT.md
 * #1) — only a hard deadline ("finished before Week 1 begins"). It is always
 * available from the moment the athlete has an active enrollment, so its
 * window start is a sentinel far enough in the past to never itself gate
 * availability; only `windowEnd` (the day before Week 1's Monday) matters
 * for Week 0's on-time/late distinction.
 */
const WEEK0_WINDOW_START_SENTINEL: IsoDate = '0001-01-01';

export function buildTestingWindows(
  input: EnrollmentScheduleInput,
): Record<TestingEventKey, TestingWindow> {
  const week0Event = getTestingEvent('week0');
  const week6Event = getTestingEvent('week6');
  const week12Event = getTestingEvent('week12');

  const week6Dates = datesForWeek(input, 6);
  const week6Wednesday = week6Dates[2]!; // Mon=0..Sun=6, per program's own "Wednesday (the off day)"

  const week12Dates = datesForWeek(input, 12);

  return {
    week0: {
      eventKey: 'week0',
      label: week0Event.label,
      markers: [...week0Event.markers],
      windowStart: WEEK0_WINDOW_START_SENTINEL,
      windowEnd: previousDay(input.startDate),
    },
    week6: {
      eventKey: 'week6',
      label: week6Event.label,
      markers: [...week6Event.markers],
      windowStart: week6Wednesday,
      windowEnd: week6Wednesday,
    },
    week12: {
      eventKey: 'week12',
      label: week12Event.label,
      markers: [...week12Event.markers],
      windowStart: week12Dates[0]!,
      windowEnd: week12Dates[6]!,
    },
  };
}

function previousDay(iso: IsoDate): IsoDate {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const epochDay = Date.UTC(y, m - 1, d) / 86_400_000 - 1;
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Session-level state, ignoring any single-marker deferral (see
 * `src/features/testing/testingResultsAggregation.ts` for the per-marker
 * state, which layers "deferred" on top of this for marker #11 at Week 0).
 */
export function computeTestingWindowState(
  window: TestingWindow,
  todayIso: IsoDate,
  session: { startedAt: string | null; completedAt: string | null } | null,
): TestingWindowState {
  if (session?.completedAt) return 'completed';
  if (session?.startedAt) return 'in_progress';
  if (todayIso < window.windowStart) return 'upcoming';
  if (todayIso <= window.windowEnd) return 'available';
  return 'missed';
}

export function testingWindowStateLabel(state: TestingWindowState): string {
  switch (state) {
    case 'upcoming':
      return 'Upcoming';
    case 'available':
      return 'Available';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'deferred':
      return 'Deferred';
    case 'missed':
      return 'Missed window';
  }
}

/** Whether marker #11's conditional Week 6 addition applies, per `testing.events.week6.conditionalMarkers`. */
export function week6IncludesConditionalSprint(deferredAtWeek0: boolean): boolean {
  return deferredAtWeek0;
}
