/**
 * Resting heart rate: "morning, before rising, 3 days averaged" (marker #1's
 * own protocol — data/program/*.json `testing.longevityTen[0].protocol`).
 * Each morning is its own row, keyed deterministically by calendar date so a
 * duplicate submission for the same morning is either rejected (unless the
 * caller explicitly opts into a correction) or upserted in place — never a
 * second silent row for the same day. The "established" baseline is only
 * ever the average of real recorded mornings, never estimated or fabricated
 * when fewer than three exist.
 */
import { deterministicId } from '../../content/seed/deterministicId';
import type { TestingResult } from './types';
import { listTestingResultsForSession, upsertTestingResult } from './testingRepository';

export const RHR_MARKER_NUMBER = 1;
export const RHR_MORNINGS_REQUIRED = 3;

export interface RhrReading {
  id: string;
  morningDate: string; // YYYY-MM-DD
  bpm: number;
  recordedAt: string;
  notes: string | null;
}

export class RhrDuplicateMorningError extends Error {
  morningDate: string;
  existingBpm: number;
  constructor(morningDate: string, existingBpm: number) {
    super(
      `A resting heart rate reading was already recorded for ${morningDate} (${existingBpm} bpm).`,
    );
    this.name = 'RhrDuplicateMorningError';
    this.morningDate = morningDate;
    this.existingBpm = existingBpm;
  }
}

function rhrReadingId(testingSessionId: string, morningDate: string): string {
  return deterministicId('testing_result_rhr_morning', testingSessionId, morningDate);
}

function toReading(row: TestingResult): RhrReading {
  return {
    id: row.id,
    morningDate: row.recorded_at.slice(0, 10),
    bpm: row.value_numeric ?? 0,
    recordedAt: row.recorded_at,
    notes: row.notes,
  };
}

/** All recorded mornings for this testing session, oldest first — a "single reading" is any one of these; the "established baseline" is `computeEstablishedRhr` below, and the two must never be presented interchangeably. */
export async function listRhrReadings(
  userId: string,
  testingSessionId: string,
): Promise<RhrReading[]> {
  const results = await listTestingResultsForSession(userId, testingSessionId);
  return results
    .filter((r) => r.marker_number === RHR_MARKER_NUMBER && r.value_numeric != null)
    .map(toReading)
    .sort((a, b) => (a.morningDate < b.morningDate ? -1 : 1));
}

export async function recordRhrReading(params: {
  userId: string;
  testingSessionId: string;
  morningDate: string;
  bpm: number;
  /** Must be explicitly true to overwrite an existing morning's reading — the caller confirms this with the athlete first. */
  allowCorrection?: boolean;
}): Promise<RhrReading> {
  const readings = await listRhrReadings(params.userId, params.testingSessionId);
  const existingIndex = readings.findIndex((r) => r.morningDate === params.morningDate);
  const existing = existingIndex >= 0 ? readings[existingIndex]! : null;

  if (existing && !params.allowCorrection) {
    throw new RhrDuplicateMorningError(params.morningDate, existing.bpm);
  }

  const id = rhrReadingId(params.testingSessionId, params.morningDate);
  const attemptNumber = existing ? existingIndex + 1 : readings.length + 1;
  const correctionNote = existing
    ? `Corrected ${new Date().toISOString()}: was ${existing.bpm} bpm.`
    : null;
  const notes = [existing?.notes, correctionNote].filter(Boolean).join(' ') || null;

  const row = await upsertTestingResult({
    id,
    userId: params.userId,
    testingSessionId: params.testingSessionId,
    markerNumber: RHR_MARKER_NUMBER,
    attemptNumber,
    valueNumeric: params.bpm,
    notes,
    recordedAt: `${params.morningDate}T06:00:00.000Z`,
  });
  return toReading(row);
}

export interface RhrMorningProgress {
  completed: number;
  required: number;
  isComplete: boolean;
}

export function computeRhrProgress(readings: RhrReading[]): RhrMorningProgress {
  const completed = Math.min(readings.length, RHR_MORNINGS_REQUIRED);
  return {
    completed,
    required: RHR_MORNINGS_REQUIRED,
    isComplete: completed >= RHR_MORNINGS_REQUIRED,
  };
}

export interface EstablishedRhr {
  /** Arithmetic mean of the first three recorded mornings, to one decimal place. */
  bpm: number;
  morningsUsed: string[];
}

/**
 * The 3-morning average per marker #1's protocol. Returns null when fewer
 * than three mornings are recorded — the caller must show "1 of 3" / "2 of
 * 3" progress instead of a baseline, never an average of an incomplete set.
 */
export function computeEstablishedRhr(readings: RhrReading[]): EstablishedRhr | null {
  const sorted = [...readings].sort((a, b) => (a.morningDate < b.morningDate ? -1 : 1));
  if (sorted.length < RHR_MORNINGS_REQUIRED) return null;
  const usable = sorted.slice(0, RHR_MORNINGS_REQUIRED);
  const mean = usable.reduce((sum, r) => sum + r.bpm, 0) / usable.length;
  return { bpm: Math.round(mean * 10) / 10, morningsUsed: usable.map((r) => r.morningDate) };
}
