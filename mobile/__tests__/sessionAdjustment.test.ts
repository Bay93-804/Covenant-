import {
  computeAdjustedSessionIds,
  isSessionAdjusted,
  safetyAdjustmentsForSession,
} from '../src/features/workout/sessionAdjustment';
import type { SafetyAdjustment, SportSession, WorkoutSession } from '../src/features/workout/types';

function workoutSession(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: 'session-1',
    client_uuid: 'session-1',
    enrollment_id: 'enrollment-1',
    user_id: 'user-1',
    program_day_id: 'day-1',
    workout_template_id: 'template-1',
    scheduled_date: '2026-01-05',
    session_slot: 'am',
    status: 'completed',
    readiness_entry_id: null,
    started_at: '2026-01-05T06:00:00Z',
    completed_at: '2026-01-05T07:00:00Z',
    duration_actual_seconds: 3000,
    completion_pct: 100,
    abandoned: false,
    synced_at: null,
    created_at: '2026-01-05T06:00:00Z',
    updated_at: '2026-01-05T07:00:00Z',
    ...overrides,
  };
}

function safetyAdjustment(overrides: Partial<SafetyAdjustment>): SafetyAdjustment {
  return {
    id: 'adj-1',
    user_id: 'user-1',
    workout_session_id: null,
    readiness_entry_id: 'readiness-1',
    trigger_code: 'RHR_ELEVATED',
    reason: 'RHR elevated 3 mornings running',
    recommended_adjustment: 'Drop to zone 2 only',
    original_prescription_snapshot: { sessionType: 'am_speed' },
    adjusted_prescription_snapshot: { triggerCode: 'RHR_ELEVATED' },
    user_confirmed: true,
    confirmed_at: '2026-01-05T05:50:00Z',
    created_at: '2026-01-05T05:45:00Z',
    ...overrides,
  };
}

describe('sessionAdjustment: deriving "adjusted" independent of workout_sessions.status', () => {
  it("a completed session sharing a confirmed adjustment's readiness_entry_id is adjusted", () => {
    const session = workoutSession({ status: 'completed', readiness_entry_id: 'readiness-1' });
    const adjustments = [
      safetyAdjustment({ readiness_entry_id: 'readiness-1', user_confirmed: true }),
    ];
    expect(isSessionAdjusted(session, adjustments)).toBe(true);
    expect(safetyAdjustmentsForSession(session, adjustments)).toHaveLength(1);
  });

  it('an unconfirmed adjustment never counts as adjusted — only a confirmed one applies', () => {
    const session = workoutSession({ status: 'completed', readiness_entry_id: 'readiness-1' });
    const adjustments = [
      safetyAdjustment({
        readiness_entry_id: 'readiness-1',
        user_confirmed: false,
        confirmed_at: null,
      }),
    ];
    expect(isSessionAdjusted(session, adjustments)).toBe(false);
  });

  it('a session with no readiness_entry_id link is never adjusted, regardless of unrelated confirmed adjustments', () => {
    const session = workoutSession({ status: 'completed', readiness_entry_id: null });
    const adjustments = [
      safetyAdjustment({ readiness_entry_id: 'readiness-1', user_confirmed: true }),
    ];
    expect(isSessionAdjusted(session, adjustments)).toBe(false);
  });

  it('a confirmed pickup-sport adjustment linked by affected_workout_session_id also counts', () => {
    const session = workoutSession({
      id: 'session-2',
      status: 'completed',
      readiness_entry_id: null,
    });
    const sportSessions: SportSession[] = [
      {
        id: 'sport-1',
        user_id: 'user-1',
        played_on: '2026-01-05',
        sport: 'Basketball',
        games_this_week: 1,
        pregame_warmup_completed: true,
        applied_adjustment_code: 'REPLACE_THU_AGILITY',
        applied_adjustment_note: 'replaces Thursday agility',
        user_confirmed: true,
        confirmed_at: '2026-01-05T08:00:00Z',
        original_prescription_snapshot: null,
        adjusted_prescription_snapshot: null,
        affected_workout_session_id: 'session-2',
        notes: null,
        created_at: '2026-01-05T08:00:00Z',
      },
    ];
    expect(isSessionAdjusted(session, [], sportSessions)).toBe(true);
  });

  it('an adjusted session that is later completed remains identifiable as both — status alone is never trusted', () => {
    const scheduledSession = workoutSession({
      id: 'session-3',
      status: 'scheduled',
      readiness_entry_id: 'readiness-2',
      completed_at: null,
    });
    const adjustments = [
      safetyAdjustment({ readiness_entry_id: 'readiness-2', user_confirmed: true }),
    ];
    // Still adjusted while only scheduled...
    expect(isSessionAdjusted(scheduledSession, adjustments)).toBe(true);
    // ...and still adjusted once completed — completing a session never erases its adjustment history.
    const completedSession = {
      ...scheduledSession,
      status: 'completed' as const,
      completed_at: '2026-01-05T09:00:00Z',
    };
    expect(completedSession.status).toBe('completed');
    expect(isSessionAdjusted(completedSession, adjustments)).toBe(true);
  });

  it('computeAdjustedSessionIds bulk-joins sessions to confirmed adjustments (safety + pickup sport)', () => {
    const sessions = [
      workoutSession({ id: 's-am', readiness_entry_id: 'r-1' }),
      workoutSession({ id: 's-pm', session_slot: 'pm', readiness_entry_id: 'r-1' }), // same-day readiness gates both slots
      workoutSession({ id: 's-unrelated', readiness_entry_id: 'r-2' }),
    ];
    const adjustments = [safetyAdjustment({ readiness_entry_id: 'r-1', user_confirmed: true })];
    const ids = computeAdjustedSessionIds(sessions, adjustments);
    expect(ids).toEqual(new Set(['s-am', 's-pm']));
  });
});
