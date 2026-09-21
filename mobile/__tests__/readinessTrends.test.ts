import {
  buildReadinessTrend,
  summarizePickupSport,
  summarizeSafetyFlags,
} from '../src/features/progress/readinessTrends';
import type { ReadinessEntry, SafetyAdjustment, SportSession } from '../src/features/workout/types';

function readiness(overrides: Partial<ReadinessEntry>): ReadinessEntry {
  return {
    id: 'r1',
    client_uuid: 'r1',
    user_id: 'u1',
    workout_session_id: null,
    entry_date: '2026-01-05',
    sleep_hours: 7,
    resting_hr: 55,
    baseline_resting_hr: 50,
    calf_achilles_flag: false,
    hamstring_grabby_flag: false,
    joint_pain_flag: false,
    joint_pain_location: null,
    readiness_score: 4,
    notes: null,
    created_at: '2026-01-05T06:00:00Z',
    ...overrides,
  };
}

describe('buildReadinessTrend', () => {
  it('sorts chronologically and flags any safety issue', () => {
    const entries = [
      readiness({ entry_date: '2026-01-06', calf_achilles_flag: true }),
      readiness({ entry_date: '2026-01-05' }),
    ];
    const trend = buildReadinessTrend(entries);
    expect(trend[0]?.date).toBe('2026-01-05');
    expect(trend[1]?.anyFlag).toBe(true);
    expect(trend[0]?.anyFlag).toBe(false);
  });
});

describe('summarizeSafetyFlags', () => {
  it('groups by trigger code and counts confirmations', () => {
    const adjustments: SafetyAdjustment[] = [
      {
        id: 'a1',
        user_id: 'u1',
        workout_session_id: null,
        readiness_entry_id: null,
        trigger_code: 'CALF_ACHILLES_WARNING',
        reason: 'flagged',
        recommended_adjustment: 'no sprint',
        original_prescription_snapshot: null,
        adjusted_prescription_snapshot: null,
        user_confirmed: true,
        confirmed_at: '2026-01-05T07:00:00Z',
        created_at: '2026-01-05T06:00:00Z',
      },
      {
        id: 'a2',
        user_id: 'u1',
        workout_session_id: null,
        readiness_entry_id: null,
        trigger_code: 'CALF_ACHILLES_WARNING',
        reason: 'flagged again',
        recommended_adjustment: 'no sprint',
        original_prescription_snapshot: null,
        adjusted_prescription_snapshot: null,
        user_confirmed: false,
        confirmed_at: null,
        created_at: '2026-01-10T06:00:00Z',
      },
    ];
    const summary = summarizeSafetyFlags(adjustments);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      triggerCode: 'CALF_ACHILLES_WARNING',
      count: 2,
      confirmedCount: 1,
    });
    expect(summary[0]?.lastOccurred).toBe('2026-01-10T06:00:00Z');
  });
});

describe('summarizePickupSport', () => {
  it('counts sessions per sport and finds the most recent date', () => {
    const sessions: SportSession[] = [
      {
        id: 's1',
        user_id: 'u1',
        played_on: '2026-01-05',
        sport: 'Basketball',
        games_this_week: 1,
        pregame_warmup_completed: true,
        applied_adjustment_code: null,
        applied_adjustment_note: null,
        user_confirmed: true,
        confirmed_at: '2026-01-05T06:00:00Z',
        original_prescription_snapshot: null,
        adjusted_prescription_snapshot: null,
        affected_workout_session_id: null,
        notes: null,
        created_at: '2026-01-05T06:00:00Z',
      },
      {
        id: 's2',
        user_id: 'u1',
        played_on: '2026-01-12',
        sport: 'Basketball',
        games_this_week: 1,
        pregame_warmup_completed: true,
        applied_adjustment_code: null,
        applied_adjustment_note: null,
        user_confirmed: true,
        confirmed_at: '2026-01-05T06:00:00Z',
        original_prescription_snapshot: null,
        adjusted_prescription_snapshot: null,
        affected_workout_session_id: null,
        notes: null,
        created_at: '2026-01-12T06:00:00Z',
      },
    ];
    const summary = summarizePickupSport(sessions);
    expect(summary.totalSessions).toBe(2);
    expect(summary.bySport).toEqual([{ sport: 'Basketball', count: 2 }]);
    expect(summary.lastPlayedOn).toBe('2026-01-12');
  });
});
