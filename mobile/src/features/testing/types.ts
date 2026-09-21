/**
 * Backend-agnostic domain types for testing *instance* data
 * (`testing_sessions` / `testing_results`), mirroring
 * src/features/workout/types.ts's pattern so demo mode and Supabase mode
 * share one set of business logic.
 */
import type { TestingResultRow, TestingSessionRow } from '../../lib/supabase/database.types';
import type { TestingEventKey } from './testingSchedule';

export type TestingSession = TestingSessionRow;
export type TestingResult = TestingResultRow;
export type { TestingEventKey };

export interface CreateTestingSessionInput {
  id: string;
  userId: string;
  enrollmentId: string;
  eventKey: TestingEventKey;
  scheduledDate?: string | null;
}

export interface UpsertTestingResultInput {
  /** Deterministic when omitted — see `testingResultId`. */
  id?: string;
  userId: string;
  testingSessionId: string;
  markerNumber: number;
  attemptNumber: number;
  side?: 'left' | 'right' | 'both' | null;
  valueNumeric?: number | null;
  valueText?: string | null;
  isBestAttempt?: boolean;
  classification?: 'below_baseline' | 'baseline' | 'solid' | 'strong' | null;
  notes?: string | null;
  /** Overrides `recorded_at` — used by the RHR workflow to stamp a specific calendar morning. */
  recordedAt?: string;
}
