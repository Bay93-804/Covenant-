/**
 * Readiness/safety trend aggregation — pure transforms over already-fetched
 * `readiness_entries` / `safety_adjustments` / `sport_sessions` rows (see
 * src/features/workout/workoutRepository.ts). Never a medical read: this
 * only counts and dates what the athlete already logged, exactly as the
 * Phase 3 readiness/safety engine recorded it.
 */
import type { ReadinessEntry, SafetyAdjustment, SportSession } from '../workout/types';

export interface ReadinessTrendPoint {
  date: string;
  sleepHours: number | null;
  restingHr: number | null;
  readinessScore: number | null;
  anyFlag: boolean;
}

export function buildReadinessTrend(entries: ReadinessEntry[]): ReadinessTrendPoint[] {
  return [...entries]
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))
    .map((e) => ({
      date: e.entry_date,
      sleepHours: e.sleep_hours,
      restingHr: e.resting_hr,
      readinessScore: e.readiness_score,
      anyFlag: e.calf_achilles_flag || e.hamstring_grabby_flag || e.joint_pain_flag,
    }));
}

export interface SafetyFlagSummary {
  triggerCode: string;
  count: number;
  lastOccurred: string;
  confirmedCount: number;
}

export function summarizeSafetyFlags(adjustments: SafetyAdjustment[]): SafetyFlagSummary[] {
  const byCode = new Map<string, SafetyAdjustment[]>();
  for (const a of adjustments) {
    const list = byCode.get(a.trigger_code) ?? [];
    list.push(a);
    byCode.set(a.trigger_code, list);
  }
  return Array.from(byCode.entries())
    .map(([triggerCode, rows]) => ({
      triggerCode,
      count: rows.length,
      confirmedCount: rows.filter((r) => r.user_confirmed).length,
      lastOccurred: rows.reduce(
        (latest, r) => (r.created_at > latest ? r.created_at : latest),
        rows[0]!.created_at,
      ),
    }))
    .sort((a, b) => (a.lastOccurred < b.lastOccurred ? 1 : -1));
}

export interface PickupSportSummary {
  totalSessions: number;
  bySport: { sport: string; count: number }[];
  lastPlayedOn: string | null;
}

export function summarizePickupSport(sessions: SportSession[]): PickupSportSummary {
  const bySportMap = new Map<string, number>();
  let lastPlayedOn: string | null = null;
  for (const s of sessions) {
    bySportMap.set(s.sport, (bySportMap.get(s.sport) ?? 0) + 1);
    if (!lastPlayedOn || s.played_on > lastPlayedOn) lastPlayedOn = s.played_on;
  }
  return {
    totalSessions: sessions.length,
    bySport: Array.from(bySportMap.entries()).map(([sport, count]) => ({ sport, count })),
    lastPlayedOn,
  };
}
