/**
 * Program adherence: turns the schedule engine's plan (which slots are
 * actually training days, per week) and the athlete's own `workout_sessions`
 * rows into weekly/overall completion numbers. Pure — takes already-fetched
 * sessions, never touches storage itself (see
 * src/features/progress/useProgress.ts for the I/O wiring).
 */
import { resolveWeekContext } from '../../content/repository';
import type { WorkoutSession } from '../workout/types';
import {
  buildScheduleRange,
  datesForWeek,
  resolveDateContext,
  type EnrollmentScheduleInput,
} from '../schedule/scheduleEngine';
import type { IsoDate } from '../schedule/dateUtils';

export interface WeekAdherence {
  weekNumber: number;
  block: string | null;
  hasStarted: boolean;
  hasFullyElapsed: boolean;
  scheduledSessionCount: number;
  completedCount: number;
  adjustedCount: number;
  missedCount: number;
  /** (completed + adjusted) / scheduled, as a percentage. 0 when nothing is scheduled yet. */
  completionPct: number;
}

export interface ProgramAdherenceSummary {
  currentWeek: number;
  currentBlock: string | null;
  weeks: WeekAdherence[];
  totalScheduled: number;
  totalCompleted: number;
  totalAdjusted: number;
  totalMissed: number;
  overallAdherencePct: number;
}

/**
 * `completedCount` and `adjustedCount` are non-overlapping subsets of
 * "trained" sessions (completed-not-adjusted vs. completed-and-adjusted),
 * computed from `adjustedSessionIds` (see
 * src/features/workout/sessionAdjustment.ts's `computeAdjustedSessionIds`)
 * rather than `workout_sessions.status`, which never actually becomes
 * 'adjusted' and would erase the adjustment fact for a completed session if
 * it did overload the column that way — a session is either counted here or
 * there, never both, but `completionPct`/`overallAdherencePct` still treat
 * both as "trained".
 */
export function computeProgramAdherence(
  input: EnrollmentScheduleInput,
  todayIso: IsoDate,
  sessions: WorkoutSession[],
  adjustedSessionIds: ReadonlySet<string> = new Set(),
): ProgramAdherenceSummary {
  const sessionByDateSlot = new Map<string, WorkoutSession>();
  for (const s of sessions) sessionByDateSlot.set(`${s.scheduled_date}:${s.session_slot}`, s);

  const weeks: WeekAdherence[] = [];
  let totalScheduled = 0;
  let totalCompleted = 0;
  let totalAdjusted = 0;
  let totalMissed = 0;

  for (let week = 1; week <= 12; week++) {
    const dates = datesForWeek(input, week);
    const weekStart = dates[0]!;
    const weekEnd = dates[dates.length - 1]!;
    const hasStarted = weekStart <= todayIso;
    const hasFullyElapsed = weekEnd < todayIso;

    let scheduledSessionCount = 0;
    let completedCount = 0;
    let adjustedCount = 0;
    let missedCount = 0;

    if (hasStarted) {
      const scheduleDays = buildScheduleRange(input, weekStart, weekEnd);
      for (const day of scheduleDays) {
        for (const slot of [day.am, day.pm] as const) {
          if (slot.isRestDay) continue;
          scheduledSessionCount += 1;
          const session = sessionByDateSlot.get(`${day.date}:${slot.slot}`);
          if (session?.status === 'completed') {
            if (adjustedSessionIds.has(session.id)) adjustedCount += 1;
            else completedCount += 1;
          } else if (day.date < todayIso) missedCount += 1;
        }
      }
    }

    const completionPct =
      scheduledSessionCount > 0
        ? ((completedCount + adjustedCount) / scheduledSessionCount) * 100
        : 0;

    weeks.push({
      weekNumber: week,
      block: resolveWeekContext(week).block?.name ?? null,
      hasStarted,
      hasFullyElapsed,
      scheduledSessionCount,
      completedCount,
      adjustedCount,
      missedCount,
      completionPct,
    });

    if (hasStarted) {
      totalScheduled += scheduledSessionCount;
      totalCompleted += completedCount;
      totalAdjusted += adjustedCount;
      totalMissed += missedCount;
    }
  }

  const currentContext = resolveDateContext(input, todayIso);
  const overallAdherencePct =
    totalScheduled > 0 ? ((totalCompleted + totalAdjusted) / totalScheduled) * 100 : 0;

  return {
    currentWeek: currentContext.weekNumber,
    currentBlock: resolveWeekContext(currentContext.weekNumber).block?.name ?? null,
    weeks,
    totalScheduled,
    totalCompleted,
    totalAdjusted,
    totalMissed,
    overallAdherencePct,
  };
}
