/**
 * A workout session's "adjusted" status is derived, never stored on the
 * session row itself. `workout_sessions.status` only ever holds completion
 * state ('scheduled'/'in_progress'/'completed'/'skipped') — Phase 3 left an
 * unused 'adjusted' enum value and no code path ever wrote it, so a session
 * that was both safety-adjusted and later completed had no reliable way to
 * be identified as adjusted (the Phase 3 defect this module fixes).
 *
 * A session counts as adjusted when it shares its `readiness_entry_id` with
 * at least one *confirmed* `safety_adjustments` row — i.e. the readiness
 * check that gated it triggered a rule the athlete explicitly confirmed.
 * This keeps completion state and adjustment history as two independent,
 * simultaneously-true facts rather than one mutually exclusive status.
 */
import type { SafetyAdjustment, SportSession, WorkoutSession } from './types';

/** Confirmed safety adjustments tied to this session's readiness check, oldest first. */
export function safetyAdjustmentsForSession(
  session: Pick<WorkoutSession, 'readiness_entry_id'>,
  safetyAdjustments: readonly SafetyAdjustment[],
): SafetyAdjustment[] {
  if (!session.readiness_entry_id) return [];
  return safetyAdjustments
    .filter((a) => a.user_confirmed && a.readiness_entry_id === session.readiness_entry_id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

/** Confirmed pickup-sport adjustments explicitly linked to this session. */
export function sportAdjustmentsForSession(
  session: Pick<WorkoutSession, 'id'>,
  sportSessions: readonly SportSession[],
): SportSession[] {
  return sportSessions
    .filter((s) => s.user_confirmed && s.affected_workout_session_id === session.id)
    .sort((a, b) => (a.played_on < b.played_on ? -1 : 1));
}

export function isSessionAdjusted(
  session: Pick<WorkoutSession, 'id' | 'readiness_entry_id'>,
  safetyAdjustments: readonly SafetyAdjustment[],
  sportSessions: readonly SportSession[] = [],
): boolean {
  return (
    safetyAdjustmentsForSession(session, safetyAdjustments).length > 0 ||
    sportAdjustmentsForSession(session, sportSessions).length > 0
  );
}

/** The set of `workout_sessions.id`s that were adjusted — for bulk joins (adherence, calendar) without an O(n*m) scan per session. */
export function computeAdjustedSessionIds(
  sessions: readonly WorkoutSession[],
  safetyAdjustments: readonly SafetyAdjustment[],
  sportSessions: readonly SportSession[] = [],
): Set<string> {
  const confirmedReadinessEntryIds = new Set(
    safetyAdjustments
      .filter((a) => a.user_confirmed && a.readiness_entry_id)
      .map((a) => a.readiness_entry_id!),
  );
  const confirmedAffectedSessionIds = new Set(
    sportSessions
      .filter((s) => s.user_confirmed && s.affected_workout_session_id)
      .map((s) => s.affected_workout_session_id!),
  );
  const adjusted = new Set<string>();
  for (const session of sessions) {
    if (
      (session.readiness_entry_id && confirmedReadinessEntryIds.has(session.readiness_entry_id)) ||
      confirmedAffectedSessionIds.has(session.id)
    ) {
      adjusted.add(session.id);
    }
  }
  return adjusted;
}
