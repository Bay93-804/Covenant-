/**
 * The single place enrollment reads/writes branch on backend (demo vs.
 * Supabase) — same pattern as src/lib/onboarding/onboardingService.ts.
 * Everything the schedule engine needs (start date, pause/restart anchor)
 * comes from here.
 */
import {
  createPauseEvent,
  getActivePauseEvent,
  listPauseEvents,
  resumePauseEvent,
} from '../../features/workout/workoutRepository';
import type { PauseEvent } from '../../features/schedule/scheduleEngine';
import { getDemoEnrollment, updateDemoEnrollment } from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import { getCurrentEnrollment, updateEnrollment } from '../supabase/mutations';

export interface CurrentEnrollment {
  id: string;
  startDate: string;
  status: 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
  currentWeekOverride: number | null;
  restartAnchorDate: string | null;
}

export async function getCurrentEnrollmentForUser(
  userId: string,
): Promise<CurrentEnrollment | null> {
  if (isSupabaseConfigured) {
    const row = await getCurrentEnrollment(userId);
    if (!row) return null;
    return {
      id: row.id,
      startDate: row.start_date,
      status: row.status,
      currentWeekOverride: row.current_week_override,
      restartAnchorDate: row.restart_anchor_date,
    };
  }

  const row = await getDemoEnrollment(userId);
  if (!row || row.status === 'completed' || row.status === 'abandoned') return null;
  return {
    id: row.id,
    startDate: row.start_date,
    status: row.status,
    currentWeekOverride: row.current_week_override,
    restartAnchorDate: row.restart_anchor_date,
  };
}

export async function getEnrollmentPauseEvents(
  userId: string,
  enrollmentId: string,
): Promise<PauseEvent[]> {
  const events = await listPauseEvents(userId, enrollmentId);
  return events.map((e) => ({ pausedAt: e.paused_at, resumedAt: e.resumed_at }));
}

export async function pauseEnrollment(
  userId: string,
  enrollmentId: string,
  reason: string | null,
): Promise<void> {
  const active = await getActivePauseEvent(userId, enrollmentId);
  if (active) return; // already paused
  await createPauseEvent(userId, enrollmentId, reason);
  if (isSupabaseConfigured) {
    await updateEnrollment(enrollmentId, { status: 'paused', paused_at: new Date().toISOString() });
  } else {
    await updateDemoEnrollment(userId, { status: 'paused' });
  }
}

export async function resumeEnrollment(userId: string, enrollmentId: string): Promise<void> {
  const active = await getActivePauseEvent(userId, enrollmentId);
  if (active) await resumePauseEvent(userId, active.id);
  if (isSupabaseConfigured) {
    await updateEnrollment(enrollmentId, { status: 'active', paused_at: null });
  } else {
    await updateDemoEnrollment(userId, { status: 'active' });
  }
}

/** Restart at the beginning of a block — never mutates any historical workout_sessions row; only changes how *future* dates are scheduled. */
export async function restartEnrollmentAtBlockStart(
  userId: string,
  enrollmentId: string,
  blockStartWeek: number,
  anchorDate: string,
): Promise<void> {
  if (isSupabaseConfigured) {
    await updateEnrollment(enrollmentId, {
      status: 'active',
      current_week_override: blockStartWeek,
      restart_anchor_date: anchorDate,
    });
  } else {
    await updateDemoEnrollment(userId, {
      status: 'active',
      current_week_override: blockStartWeek,
      restart_anchor_date: anchorDate,
    });
  }
}
