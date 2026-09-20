/**
 * The one hook screens use to get "where is this athlete in the program
 * right now" — wraps the enrollment service + pause history into the
 * `EnrollmentScheduleInput` the schedule engine needs, resolved against the
 * device's current IANA timezone (so "today" always matches wherever the
 * athlete's phone currently is, per the PRD's "preserve timezone"
 * requirement — there's no separate stored value to drift out of sync).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCurrentEnrollmentForUser,
  getEnrollmentPauseEvents,
} from '../../lib/enrollment/enrollmentService';
import { useAuth } from '../../lib/auth/AuthContext';
import type { EnrollmentScheduleInput } from '../schedule/scheduleEngine';
import { todayIso } from '../schedule/dateUtils';

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface EnrollmentScheduleContext {
  enrollmentId: string;
  scheduleInput: EnrollmentScheduleInput;
  status: 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
  todayIso: string;
}

async function fetchEnrollmentScheduleContext(
  userId: string,
): Promise<EnrollmentScheduleContext | null> {
  const enrollment = await getCurrentEnrollmentForUser(userId);
  if (!enrollment) return null;

  const pauseEvents = await getEnrollmentPauseEvents(userId, enrollment.id);
  const timezone = getDeviceTimeZone();

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    todayIso: todayIso(timezone),
    scheduleInput: {
      startDate: enrollment.startDate,
      timezone,
      currentWeekOverride: enrollment.currentWeekOverride,
      restartAnchorDate: enrollment.restartAnchorDate,
      pauseEvents,
    },
  };
}

export function useEnrollmentSchedule() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['enrollment-schedule', user?.id],
    queryFn: () => fetchEnrollmentScheduleContext(user!.id),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

export function useInvalidateEnrollmentSchedule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => queryClient.invalidateQueries({ queryKey: ['enrollment-schedule', user?.id] });
}
