/**
 * Enrollment -> `EnrollmentScheduleInput` conversion, free of React/auth
 * imports so services and tests can use it directly (the hook wrapper lives
 * in ./useEnrollmentSchedule.ts).
 */
import {
  getEnrollmentForUserById,
  getEnrollmentPauseEvents,
  type CurrentEnrollment,
} from '../../lib/enrollment/enrollmentService';
import type { EnrollmentScheduleInput } from '../schedule/scheduleEngine';

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function buildScheduleInput(
  userId: string,
  enrollment: CurrentEnrollment,
  timezone: string,
): Promise<EnrollmentScheduleInput> {
  const pauseEvents = await getEnrollmentPauseEvents(userId, enrollment.id);
  return {
    startDate: enrollment.startDate,
    timezone,
    currentWeekOverride: enrollment.currentWeekOverride,
    restartAnchorDate: enrollment.restartAnchorDate,
    pauseEvents,
  };
}

/**
 * The schedule input for any one of the user's runs, current or archived —
 * an archived run's sessions must be resolved against that run's own start
 * date, not the current run's (which, after Restart Program, would map the
 * old dates to Week 0 or the wrong week).
 */
export async function fetchScheduleInputForEnrollment(
  userId: string,
  enrollmentId: string,
): Promise<EnrollmentScheduleInput | null> {
  const enrollment = await getEnrollmentForUserById(userId, enrollmentId);
  if (!enrollment) return null;
  return buildScheduleInput(userId, enrollment, getDeviceTimeZone());
}
