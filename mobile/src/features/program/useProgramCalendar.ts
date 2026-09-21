/**
 * Data for the Program tab: a 12-week calendar (plus Week 0) with
 * completion/adjusted/missed/upcoming state per AM/PM session, built from
 * the schedule engine (content/dates) joined with whatever
 * `workout_sessions` rows exist (instance/progress) — never the other way
 * around, so a schedule recompute (pause/restart) never edits a historical
 * row.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import { addDays } from '../schedule/dateUtils';
import {
  buildScheduleRange,
  datesForWeek,
  type EnrollmentScheduleInput,
  type ScheduledDay,
} from '../schedule/scheduleEngine';
import {
  listSafetyAdjustments,
  listSessionsInRange,
  listSportSessions,
} from '../workout/workoutRepository';
import { computeAdjustedSessionIds } from '../workout/sessionAdjustment';
import type { WorkoutSession } from '../workout/types';
import { useEnrollmentSchedule } from './useEnrollmentSchedule';

export type DayCalendarState =
  'completed' | 'in_progress' | 'missed' | 'upcoming' | 'today' | 'rest';

export interface DayCalendarEntry {
  scheduledDay: ScheduledDay;
  amSession: WorkoutSession | null;
  pmSession: WorkoutSession | null;
  amState: DayCalendarState;
  pmState: DayCalendarState;
  /** True when `amSession`/`pmSession` was safety- or pickup-sport-adjusted — independent of `amState`/`pmState`, so a day can be shown as both completed and adjusted at once (see sessionAdjustment.ts). */
  amAdjusted: boolean;
  pmAdjusted: boolean;
}

export interface WeekCalendarSummary {
  weekNumber: number;
  days: DayCalendarEntry[];
  totalTrainingSlots: number;
  completedSlots: number;
  missedSlots: number;
}

function resolveState(
  scheduled: ScheduledDay['am'],
  session: WorkoutSession | null,
  date: string,
  today: string,
): DayCalendarState {
  if (scheduled.isRestDay) return 'rest';
  if (session?.status === 'completed') return 'completed';
  if (session?.status === 'in_progress') return 'in_progress';
  if (date === today) return 'today';
  if (date < today) return 'missed';
  return 'upcoming';
}

async function fetchProgramCalendar(
  userId: string,
  enrollmentId: string,
  scheduleInput: EnrollmentScheduleInput,
  today: string,
): Promise<WeekCalendarSummary[]> {
  const rangeStart = scheduleInput.startDate;
  const rangeEnd = addDays(scheduleInput.startDate, 7 * 14); // Week 0 through Week 12 inclusive, generous bound for pause offsets
  const [sessions, safetyAdjustments, sportSessions] = await Promise.all([
    listSessionsInRange(userId, enrollmentId, rangeStart, rangeEnd),
    listSafetyAdjustments(userId),
    listSportSessions(userId),
  ]);
  const adjustedSessionIds = computeAdjustedSessionIds(sessions, safetyAdjustments, sportSessions);

  const sessionByKey = new Map<string, WorkoutSession>();
  for (const s of sessions) sessionByKey.set(`${s.scheduled_date}:${s.session_slot}`, s);

  const weeks: WeekCalendarSummary[] = [];
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    const dates = datesForWeek(scheduleInput, weekNumber);
    const scheduledDays = buildScheduleRange(scheduleInput, dates[0]!, dates[dates.length - 1]!);

    const days: DayCalendarEntry[] = scheduledDays.map((scheduledDay) => {
      const amSession = sessionByKey.get(`${scheduledDay.date}:am`) ?? null;
      const pmSession = sessionByKey.get(`${scheduledDay.date}:pm`) ?? null;
      return {
        scheduledDay,
        amSession,
        pmSession,
        amState: resolveState(scheduledDay.am, amSession, scheduledDay.date, today),
        pmState: resolveState(scheduledDay.pm, pmSession, scheduledDay.date, today),
        amAdjusted: amSession != null && adjustedSessionIds.has(amSession.id),
        pmAdjusted: pmSession != null && adjustedSessionIds.has(pmSession.id),
      };
    });

    const slotStates = days.flatMap((d) => [d.amState, d.pmState]).filter((s) => s !== 'rest');
    weeks.push({
      weekNumber,
      days,
      totalTrainingSlots: slotStates.length,
      completedSlots: slotStates.filter((s) => s === 'completed').length,
      missedSlots: slotStates.filter((s) => s === 'missed').length,
    });
  }

  return weeks;
}

export function useProgramCalendar() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();

  return useQuery({
    queryKey: ['program-calendar', user?.id, scheduleContext?.enrollmentId],
    queryFn: () =>
      fetchProgramCalendar(
        user!.id,
        scheduleContext!.enrollmentId,
        scheduleContext!.scheduleInput,
        scheduleContext!.todayIso,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}
