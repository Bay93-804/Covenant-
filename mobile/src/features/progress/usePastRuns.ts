/**
 * Archived program runs (Restart Program) and what was actually done in
 * each — read-only history. Each run's sessions are resolved against that
 * run's own schedule (start date, pauses), never the current run's.
 */
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import {
  listArchivedEnrollmentsForUser,
  type CurrentEnrollment,
} from '../../lib/enrollment/enrollmentService';
import { fetchScheduleInputForEnrollment } from '../program/enrollmentScheduleInput';
import { buildScheduledDay } from '../schedule/scheduleEngine';
import { listTestingSessions } from '../testing/testingRepository';
import { listSessionsInRange } from '../workout/workoutRepository';

export interface PastRunWorkout {
  sessionId: string;
  date: string;
  slot: 'am' | 'pm';
  title: string;
  weekNumber: number;
}

export interface PastRun {
  enrollment: CurrentEnrollment;
  completedWorkouts: PastRunWorkout[];
  completedTestingEvents: number;
}

async function fetchPastRuns(userId: string): Promise<PastRun[]> {
  const runs = await listArchivedEnrollmentsForUser(userId);
  return Promise.all(
    runs.map(async (enrollment) => {
      const [sessions, testingSessions, scheduleInput] = await Promise.all([
        listSessionsInRange(userId, enrollment.id, '0000-01-01', '9999-12-31'),
        listTestingSessions(userId, enrollment.id),
        fetchScheduleInputForEnrollment(userId, enrollment.id),
      ]);
      const completedWorkouts = sessions
        .filter((s) => s.status === 'completed')
        .map((s) => {
          const day = scheduleInput ? buildScheduledDay(scheduleInput, s.scheduled_date) : null;
          return {
            sessionId: s.id,
            date: s.scheduled_date,
            slot: s.session_slot,
            title: day ? day[s.session_slot].title : `${s.session_slot.toUpperCase()} session`,
            weekNumber: day?.weekNumber ?? 0,
          };
        })
        .sort((a, b) =>
          a.date === b.date ? a.slot.localeCompare(b.slot) : a.date.localeCompare(b.date),
        );
      return {
        enrollment,
        completedWorkouts,
        completedTestingEvents: testingSessions.filter((t) => t.completed_at).length,
      };
    }),
  );
}

export function usePastRuns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['past-runs', user?.id],
    queryFn: () => fetchPastRuns(user!.id),
    enabled: Boolean(user),
  });
}
