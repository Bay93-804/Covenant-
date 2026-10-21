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
import {
  DemoRestartError,
  getDemoEnrollment,
  getDemoEnrollmentHistory,
  restartDemoEnrollment,
  updateDemoEnrollment,
  type DemoEnrollment,
} from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import type { ProgramEnrollmentRow } from '../supabase/database.types';
import {
  getCurrentEnrollment,
  getEnrollmentById,
  listArchivedEnrollments,
  restartProgramRpc,
  updateEnrollment,
} from '../supabase/mutations';

export interface CurrentEnrollment {
  id: string;
  startDate: string;
  status: 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
  currentWeekOverride: number | null;
  restartAnchorDate: string | null;
  restartedFromEnrollmentId: string | null;
  archivedAt: string | null;
  createdAt: string;
}

function fromRow(row: ProgramEnrollmentRow | DemoEnrollment): CurrentEnrollment {
  return {
    id: row.id,
    startDate: row.start_date,
    status: row.status,
    currentWeekOverride: row.current_week_override,
    restartAnchorDate: row.restart_anchor_date,
    restartedFromEnrollmentId: row.restarted_from_enrollment_id ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
  };
}

/** The user's current (active or paused) run — never an archived one. */
export async function getCurrentEnrollmentForUser(
  userId: string,
): Promise<CurrentEnrollment | null> {
  if (isSupabaseConfigured) {
    const row = await getCurrentEnrollment(userId);
    return row ? fromRow(row) : null;
  }

  const row = await getDemoEnrollment(userId);
  if (!row || (row.status !== 'active' && row.status !== 'paused')) return null;
  return fromRow(row);
}

/** Any one of the user's runs, current or archived — e.g. to rebuild an archived session's plan. */
export async function getEnrollmentForUserById(
  userId: string,
  enrollmentId: string,
): Promise<CurrentEnrollment | null> {
  if (isSupabaseConfigured) {
    const row = await getEnrollmentById(enrollmentId);
    return row && row.user_id === userId ? fromRow(row) : null;
  }
  const current = await getDemoEnrollment(userId);
  if (current?.id === enrollmentId) return fromRow(current);
  const archived = (await getDemoEnrollmentHistory(userId)).find((e) => e.id === enrollmentId);
  return archived ? fromRow(archived) : null;
}

/** Past runs (restarted/abandoned/completed), newest first. */
export async function listArchivedEnrollmentsForUser(userId: string): Promise<CurrentEnrollment[]> {
  if (isSupabaseConfigured) {
    return (await listArchivedEnrollments(userId)).map(fromRow);
  }
  return (await getDemoEnrollmentHistory(userId)).map(fromRow);
}

export type RestartProgramErrorCode =
  'not_current' | 'not_found' | 'invalid_start_date' | 'network' | 'unknown';

export class RestartProgramError extends Error {
  constructor(
    readonly code: RestartProgramErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function toRestartError(e: unknown): RestartProgramError {
  if (e instanceof RestartProgramError) return e;
  if (e instanceof DemoRestartError) return new RestartProgramError(e.code, e.message);
  const code = (e as { code?: unknown } | null)?.code;
  const message =
    e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  switch (code) {
    case 'CCR02':
      return new RestartProgramError('invalid_start_date', 'Week 1 must start on a Monday.');
    case 'CCR03':
      return new RestartProgramError(
        'not_found',
        'We couldn\u2019t find your current program run.',
      );
    case 'CCR04':
    case '23505':
      return new RestartProgramError(
        'not_current',
        'Your program was already restarted (possibly on another device). Pull to refresh and check your calendar.',
      );
  }
  if (/network|fetch|timed? ?out|offline/i.test(message)) {
    return new RestartProgramError(
      'network',
      'You appear to be offline. Restarting needs a connection — nothing was changed. Try again when you\u2019re back online.',
    );
  }
  return new RestartProgramError('unknown', `Restart failed — nothing was changed. (${message})`);
}

const restartsInFlight = new Map<string, Promise<CurrentEnrollment>>();

/**
 * Restart Program: archives `currentEnrollmentId` (keeping every workout,
 * testing result, check-in, and pause record attached to it) and creates a
 * new active run whose Week 1, Day 1 is `newStartDate` (a Monday).
 *
 * Safe against repeated taps at three levels: concurrent calls for the same
 * run share one in-flight promise here; the server RPC / demo store return
 * the already-created run for a repeated id; and the database's
 * one-current-run unique index rejects anything else.
 */
export function restartProgram(
  userId: string,
  currentEnrollmentId: string,
  newStartDate: string,
): Promise<CurrentEnrollment> {
  const key = `${userId}:${currentEnrollmentId}`;
  const existing = restartsInFlight.get(key);
  if (existing) return existing;

  const run = (async () => {
    try {
      if (isSupabaseConfigured) {
        return fromRow(await restartProgramRpc(currentEnrollmentId, newStartDate));
      }
      return fromRow(await restartDemoEnrollment(userId, currentEnrollmentId, newStartDate));
    } catch (e) {
      throw toRestartError(e);
    }
  })().finally(() => restartsInFlight.delete(key));

  restartsInFlight.set(key, run);
  return run;
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
