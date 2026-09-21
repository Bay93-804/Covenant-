/**
 * The testing-instance repository — every screen that reads or writes a
 * `testing_sessions` or `testing_results` row goes through here, following
 * the exact pattern `src/features/workout/workoutRepository.ts` established
 * in Phase 3: local offline store first (instant, works offline, survives
 * app restart), background push to Supabase only when configured. IDs are
 * deterministic (see `deterministicId`) wherever a natural key exists —
 * (session, marker, attempt, side) for a result, (enrollment, event) for a
 * session — so a retried autosave or a duplicate tap always upserts the same
 * row instead of creating a duplicate ("prevent accidental duplicate
 * submission" / offline idempotency, per docs/phase1/DATABASE_SCHEMA.md).
 */
import { deterministicId } from '../../content/seed/deterministicId';
import { isSupabaseConfigured } from '../../lib/env';
import {
  Collections,
  findById,
  nowIso,
  queryAll,
  upsert,
} from '../../lib/offline/localWorkoutStore';
import { queueBackgroundSync } from '../workout/syncEngine';
import type {
  CreateTestingSessionInput,
  TestingEventKey,
  TestingResult,
  TestingSession,
  UpsertTestingResultInput,
} from './types';

function maybeSync(userId: string) {
  if (isSupabaseConfigured) queueBackgroundSync(userId);
}

// ---------------------------------------------------------------------------
// Testing sessions — one per (enrollment, event_key), matching the DB's own
// unique constraint, so re-opening Week 0/6/12 never creates a second row.
// ---------------------------------------------------------------------------

export function testingSessionId(enrollmentId: string, eventKey: TestingEventKey): string {
  return deterministicId('testing_session', enrollmentId, eventKey);
}

export async function getTestingSession(
  userId: string,
  enrollmentId: string,
  eventKey: TestingEventKey,
): Promise<TestingSession | null> {
  return findById<TestingSession>(
    userId,
    Collections.testingSessions,
    testingSessionId(enrollmentId, eventKey),
  );
}

export async function getTestingSessionById(
  userId: string,
  id: string,
): Promise<TestingSession | null> {
  return findById<TestingSession>(userId, Collections.testingSessions, id);
}

/** Creates the session row the first time an event is opened, or returns the existing one — never overwrites. */
export async function getOrCreateTestingSession(
  input: CreateTestingSessionInput,
): Promise<TestingSession> {
  const id = testingSessionId(input.enrollmentId, input.eventKey);
  const existing = await findById<TestingSession>(input.userId, Collections.testingSessions, id);
  if (existing) return existing;

  const row: TestingSession = {
    id,
    user_id: input.userId,
    enrollment_id: input.enrollmentId,
    event_key: input.eventKey,
    scheduled_date: input.scheduledDate ?? null,
    started_at: null,
    completed_at: null,
    created_at: nowIso(),
  };
  await upsert(input.userId, Collections.testingSessions, row);
  maybeSync(input.userId);
  return row;
}

export async function listTestingSessions(
  userId: string,
  enrollmentId: string,
): Promise<TestingSession[]> {
  return queryAll<TestingSession>(
    userId,
    Collections.testingSessions,
    (s) => s.enrollment_id === enrollmentId,
  );
}

export async function startTestingSession(
  userId: string,
  sessionId: string,
): Promise<TestingSession> {
  const existing = await findById<TestingSession>(userId, Collections.testingSessions, sessionId);
  if (!existing) throw new Error(`No testing session ${sessionId}`);
  if (existing.started_at) return existing;
  const next: TestingSession = { ...existing, started_at: nowIso() };
  await upsert(userId, Collections.testingSessions, next);
  maybeSync(userId);
  return next;
}

/** Duplicate-finalization guard: finalizing an already-completed session is a no-op that returns the existing record. */
export async function completeTestingSession(
  userId: string,
  sessionId: string,
): Promise<TestingSession> {
  const existing = await findById<TestingSession>(userId, Collections.testingSessions, sessionId);
  if (!existing) throw new Error(`No testing session ${sessionId}`);
  if (existing.completed_at) return existing;
  const next: TestingSession = { ...existing, completed_at: nowIso() };
  await upsert(userId, Collections.testingSessions, next);
  maybeSync(userId);
  return next;
}

// ---------------------------------------------------------------------------
// Testing results — raw attempts. Idempotent by (session, marker, attempt,
// side) so autosave/resume and duplicate taps never duplicate an attempt row.
// ---------------------------------------------------------------------------

export function testingResultId(
  testingSessionId_: string,
  markerNumber: number,
  attemptNumber: number,
  side: string | null | undefined,
): string {
  return deterministicId(
    'testing_result',
    testingSessionId_,
    markerNumber,
    attemptNumber,
    side ?? 'na',
  );
}

export async function upsertTestingResult(input: UpsertTestingResultInput): Promise<TestingResult> {
  const id =
    input.id ||
    testingResultId(input.testingSessionId, input.markerNumber, input.attemptNumber, input.side);
  const existing = await findById<TestingResult>(input.userId, Collections.testingResults, id);

  const row: TestingResult = {
    id,
    client_uuid: id,
    testing_session_id: input.testingSessionId,
    user_id: input.userId,
    marker_number: input.markerNumber,
    attempt_number: input.attemptNumber,
    side: input.side ?? null,
    value_numeric: input.valueNumeric ?? null,
    value_text: input.valueText ?? null,
    is_best_attempt: input.isBestAttempt ?? false,
    classification: input.classification ?? null,
    notes: input.notes ?? null,
    recorded_at: input.recordedAt ?? existing?.recorded_at ?? nowIso(),
  };
  await upsert(input.userId, Collections.testingResults, row);
  maybeSync(input.userId);
  return row;
}

export async function listTestingResultsForSession(
  userId: string,
  testingSessionId_: string,
): Promise<TestingResult[]> {
  const rows = await queryAll<TestingResult>(
    userId,
    Collections.testingResults,
    (r) => r.testing_session_id === testingSessionId_,
  );
  return rows.sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));
}

/** Every recorded attempt for a marker across every testing session — powers marker-history and Week 0/6/12 comparisons. */
export async function listTestingResultsForMarker(
  userId: string,
  markerNumber: number,
): Promise<TestingResult[]> {
  const rows = await queryAll<TestingResult>(
    userId,
    Collections.testingResults,
    (r) => r.marker_number === markerNumber,
  );
  return rows.sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));
}

export async function listAllTestingResults(userId: string): Promise<TestingResult[]> {
  return queryAll<TestingResult>(userId, Collections.testingResults, () => true);
}

/** Clears (marks unset) a specific attempt without deleting its row, so "correction" always has an auditable prior value rather than silently vanishing. Used only for explicit user-confirmed corrections. */
export async function correctTestingResult(
  userId: string,
  id: string,
  patch: Pick<UpsertTestingResultInput, 'valueNumeric' | 'valueText' | 'notes' | 'classification'>,
): Promise<TestingResult> {
  const existing = await findById<TestingResult>(userId, Collections.testingResults, id);
  if (!existing) throw new Error(`No testing result ${id}`);

  const priorNote =
    existing.value_numeric != null || existing.value_text != null
      ? `Corrected ${nowIso()}: was ${existing.value_numeric ?? existing.value_text}.`
      : null;
  const combinedNotes = [priorNote, patch.notes ?? existing.notes].filter(Boolean).join(' ');

  const next: TestingResult = {
    ...existing,
    value_numeric: patch.valueNumeric !== undefined ? patch.valueNumeric : existing.value_numeric,
    value_text: patch.valueText !== undefined ? patch.valueText : existing.value_text,
    classification:
      patch.classification !== undefined ? patch.classification : existing.classification,
    notes: combinedNotes || null,
  };
  await upsert(userId, Collections.testingResults, next);
  maybeSync(userId);
  return next;
}
