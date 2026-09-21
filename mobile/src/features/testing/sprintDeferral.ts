/**
 * The Week 0 sprint-deferral path (marker #11 only — see
 * data/program/*.json `testing.athleticFive[0].caution` and
 * `testing.events.week0.schedulingRules.sprintDeferral`): markers #12-15
 * are still tested normally at Week 0 even when #11 is deferred. A deferral
 * is stored as its own sentinel `testing_results` row (attempt_number 0,
 * `value_text: 'deferred'`) rather than a schema change — it carries a
 * reason and date exactly like a real attempt would, so it shows up
 * wherever testing history is listed, and Week 0 completion logic can
 * recognize "deferred" as distinct from "missing".
 */
import { deterministicId } from '../../content/seed/deterministicId';
import type { TestingResult } from './types';
import { listTestingResultsForSession, upsertTestingResult } from './testingRepository';

export const SPRINT_MARKER_NUMBER = 11;
/** Sentinel attempt number for a deferral row — never a real attempt. */
export const SPRINT_DEFERRAL_ATTEMPT_NUMBER = 0;

export interface SprintDeferral {
  id: string;
  reason: string;
  deferredDate: string; // YYYY-MM-DD
}

function sprintDeferralId(testingSessionId: string): string {
  return deterministicId('testing_result_sprint_deferral', testingSessionId);
}

export function isSprintDeferralRow(row: TestingResult): boolean {
  return (
    row.marker_number === SPRINT_MARKER_NUMBER &&
    row.attempt_number === SPRINT_DEFERRAL_ATTEMPT_NUMBER &&
    row.value_text === 'deferred'
  );
}

function toDeferral(row: TestingResult): SprintDeferral {
  return { id: row.id, reason: row.notes ?? '', deferredDate: row.recorded_at.slice(0, 10) };
}

export async function recordSprintDeferral(params: {
  userId: string;
  testingSessionId: string;
  reason: string;
  deferredDate: string;
}): Promise<SprintDeferral> {
  const row = await upsertTestingResult({
    id: sprintDeferralId(params.testingSessionId),
    userId: params.userId,
    testingSessionId: params.testingSessionId,
    markerNumber: SPRINT_MARKER_NUMBER,
    attemptNumber: SPRINT_DEFERRAL_ATTEMPT_NUMBER,
    valueText: 'deferred',
    notes: params.reason,
    recordedAt: `${params.deferredDate}T12:00:00.000Z`,
  });
  return toDeferral(row);
}

export async function getSprintDeferral(
  userId: string,
  testingSessionId: string,
): Promise<SprintDeferral | null> {
  const results = await listTestingResultsForSession(userId, testingSessionId);
  const row = results.find(isSprintDeferralRow);
  return row ? toDeferral(row) : null;
}

/** True once a real (non-deferred) attempt for marker #11 has been recorded in this session. */
export function hasCompletedSprintAttempt(results: TestingResult[]): boolean {
  return results.some(
    (r) =>
      r.marker_number === SPRINT_MARKER_NUMBER &&
      !isSprintDeferralRow(r) &&
      r.value_numeric != null,
  );
}
