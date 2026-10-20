/**
 * The one hook screens use to get "where is this athlete in the program
 * right now" — wraps the enrollment service + pause history into the
 * `EnrollmentScheduleInput` the schedule engine needs, resolved against the
 * device's current IANA timezone (so "today" always matches wherever the
 * athlete's phone currently is, per the PRD's "preserve timezone"
 * requirement — there's no separate stored value to drift out of sync).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getCurrentEnrollmentForUser } from '../../lib/enrollment/enrollmentService';
import { useAuth } from '../../lib/auth/AuthContext';
import type { EnrollmentScheduleInput } from '../schedule/scheduleEngine';
import { isoDateInTimeZone, todayIso } from '../schedule/dateUtils';
import {
  buildScheduleInput,
  fetchScheduleInputForEnrollment,
  getDeviceTimeZone,
} from './enrollmentScheduleInput';

export { fetchScheduleInputForEnrollment, getDeviceTimeZone };

export interface EnrollmentScheduleContext {
  enrollmentId: string;
  scheduleInput: EnrollmentScheduleInput;
  status: 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
  todayIso: string;
  /** The current run's creation date in the device timezone (`YYYY-MM-DD`). */
  createdOnIso: string | null;
}

async function fetchEnrollmentScheduleContext(
  userId: string,
): Promise<EnrollmentScheduleContext | null> {
  const enrollment = await getCurrentEnrollmentForUser(userId);
  if (!enrollment) return null;

  const timezone = getDeviceTimeZone();

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    todayIso: todayIso(timezone),
    createdOnIso: enrollment.createdAt
      ? isoDateInTimeZone(new Date(enrollment.createdAt), timezone)
      : null,
    scheduleInput: await buildScheduleInput(userId, enrollment, timezone),
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
