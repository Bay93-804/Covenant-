/**
 * "Two missed weeks -> recommend restarting at the beginning of the current
 * block" (PDF safety rule). A week counts as missed when every one of its
 * training days (Mon/Tue/Thu/Sat — the 4 days the weekly template actually
 * schedules training on) is fully in the past and none of them has a
 * completed session. Week 0 (baseline testing) and any week that isn't
 * fully elapsed yet are never counted.
 */
import type { IsoDate } from './dateUtils';
import { buildScheduleRange, datesForWeek, type EnrollmentScheduleInput } from './scheduleEngine';

export interface MissedWeeksResult {
  missedWeekNumbers: number[];
  shouldRecommendRestart: boolean;
  restartBlockStartWeek: number | null;
}

/**
 * @param completedOrScheduledDates Calendar dates (`YYYY-MM-DD`) on which the
 *   athlete has at least one `workout_sessions` row with status
 *   'completed' or 'adjusted' (adjusted-but-done still counts as trained).
 */
export function detectMissedWeeks(
  input: EnrollmentScheduleInput,
  todayIso: IsoDate,
  completedOrScheduledDates: ReadonlySet<IsoDate>,
): MissedWeeksResult {
  const missedWeekNumbers: number[] = [];

  for (let week = 1; week <= 12; week++) {
    const dates = datesForWeek(input, week);
    const weekEnd = dates[dates.length - 1];
    if (weekEnd >= todayIso) break; // week not fully elapsed yet

    const scheduleDays = buildScheduleRange(input, dates[0], weekEnd);
    const trainingDates = scheduleDays.filter((d) => !d.am.isRestDay || !d.pm.isRestDay);
    if (trainingDates.length === 0) continue;

    const anyCompleted = trainingDates.some((d) => completedOrScheduledDates.has(d.date));
    if (!anyCompleted) missedWeekNumbers.push(week);
  }

  const shouldRecommendRestart = missedWeekNumbers.length >= 2;
  let restartBlockStartWeek: number | null = null;
  if (shouldRecommendRestart) {
    const currentWeek = resolveCurrentBlockStart(missedWeekNumbers[missedWeekNumbers.length - 1]);
    restartBlockStartWeek = currentWeek;
  }

  return { missedWeekNumbers, shouldRecommendRestart, restartBlockStartWeek };
}

/** Block 1 = weeks 1-4, Block 2 = weeks 5-8, Block 3 = weeks 9-12. */
function resolveCurrentBlockStart(weekNumber: number): number {
  if (weekNumber <= 4) return 1;
  if (weekNumber <= 8) return 5;
  return 9;
}
