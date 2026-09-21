/**
 * Marker-specific input shapes, unit parsing/formatting, and classification
 * against the program's own authoritative baseline/solid/strong values
 * (`data/program/coach-conde-long-game-athletic-v1.json`'s
 * `testing.longevityTen`/`testing.athleticFive` — see
 * docs/phase1/PROGRAM_CONTENT_MODEL.md). Classification never invents a
 * threshold: every comparison is against the exact baseline/solid/strong
 * value already present on the marker definition, converted to a comparable
 * number via the same unit-parsing rules used for user input.
 *
 * Each of the 15 markers gets an explicit input kind here (never a generic
 * numeric field) because the protocols genuinely differ: some are single
 * numbers, some are timed with two different textual formats in the PDF's
 * own table ("60s" vs "2:00"), some are feet-inches, one is qualitative text,
 * some require attempts + a best-attempt rule, two are bilateral, one is a
 * computed difference of two raw times, and one is derived from a heavy-5
 * set via the program's own e1RM formula.
 */
import type { TestingMarker } from '../../content/schema';

export type MarkerInputKind =
  | 'rhr_three_morning'
  | 'mmss'
  | 'numeric'
  | 'time_flexible'
  | 'qualitative'
  | 'sprint_10yd'
  | 'broad_jump'
  | 'cmj'
  | 'pro_agility'
  | 'deceleration_deficit'
  | 'bilateral_attempts_time'
  | 'bilateral_time'
  | 'e1rm_heavy5';

const MARKER_INPUT_KIND: Record<number, MarkerInputKind> = {
  1: 'rhr_three_morning',
  2: 'mmss',
  3: 'numeric',
  // Marker #4's protocol text says "best of 2" per side even though the
  // structured content model has no `attempts` field for it (see
  // docs/phase1/EXTRACTION_AUDIT.md-style gap, flagged in the Phase 4
  // completion report) — the protocol string is honored.
  4: 'bilateral_attempts_time',
  5: 'numeric',
  6: 'time_flexible',
  7: 'e1rm_heavy5',
  8: 'numeric',
  9: 'bilateral_time',
  10: 'qualitative',
  11: 'sprint_10yd',
  12: 'broad_jump',
  13: 'cmj',
  14: 'pro_agility',
  15: 'deceleration_deficit',
};

export function getMarkerInputKind(markerNumber: number): MarkerInputKind {
  const kind = MARKER_INPUT_KIND[markerNumber];
  if (!kind) throw new Error(`No input-kind mapping for marker #${markerNumber}`);
  return kind;
}

// ---------------------------------------------------------------------------
// Unit parsing / formatting
// ---------------------------------------------------------------------------

/** Parses "M:SS" or "M:SS.d" into total seconds. Returns null on malformed input — never guesses. */
export function parseMmSs(raw: string): number | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+):([0-5]\d)(?:\.(\d+))?$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const frac = match[3] ? Number(`0.${match[3]}`) : 0;
  return minutes * 60 + seconds + frac;
}

export function formatSecondsAsMmSs(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs - minutes * 60;
  const roundedSeconds = Math.round(seconds * 10) / 10;
  const secondsStr =
    roundedSeconds < 10
      ? `0${Number.isInteger(roundedSeconds) ? roundedSeconds : roundedSeconds.toFixed(1)}`
      : `${Number.isInteger(roundedSeconds) ? roundedSeconds : roundedSeconds.toFixed(1)}`;
  return `${sign}${minutes}:${secondsStr}`;
}

/** The Deep Squat Hold marker prints its baseline as "60s" but solid/strong as "2:00"/"3:00" in the source PDF table — both forms must parse. */
export function parseFlexibleTime(raw: string): number | null {
  const trimmed = raw.trim();
  const mmss = parseMmSs(trimmed);
  if (mmss != null) return mmss;
  const secondsMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (secondsMatch) return Number(secondsMatch[1]);
  const plain = Number(trimmed);
  return Number.isFinite(plain) ? plain : null;
}

export function feetInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}

export function formatInchesAsFeetInches(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 10) / 10;
  const inchesStr = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
  return `${feet}'${inchesStr}"`;
}

/** Parses the PDF's own `6'6"` style string (used for baseline/solid/strong thresholds). */
export function parseFeetInchesString(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)'\s*(\d+(?:\.\d+)?)"?$/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
}

/** Converts a marker's baseline/solid/strong value (number or PDF-format string) into a comparable number, using the marker's own unit — never a fabricated conversion. */
export function thresholdToComparable(marker: TestingMarker, raw: number | string): number | null {
  if (typeof raw === 'number') return raw;
  if (marker.unit === 'mm:ss') return parseMmSs(raw);
  if (marker.unit === 'ft-in') return parseFeetInchesString(raw);
  if (marker.unit === 'time') return parseFlexibleTime(raw);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Classification against the program's own baseline/solid/strong values
// ---------------------------------------------------------------------------

export type MarkerTier = 'below_baseline' | 'baseline' | 'solid' | 'strong';

/**
 * Classifies a comparable numeric result against the marker's own
 * baseline/solid/strong thresholds (from the approved program content — not
 * invented here). Returns null when the marker is qualitative (use
 * `classifyQualitativeResult`) or a threshold fails to parse, rather than
 * guessing a tier.
 */
export function classifyNumericResult(
  marker: TestingMarker,
  comparableValue: number,
): MarkerTier | null {
  if (marker.thresholdOp === 'qualitative') return null;
  const baseline = thresholdToComparable(marker, marker.baseline);
  const solid = thresholdToComparable(marker, marker.solid);
  const strong = thresholdToComparable(marker, marker.strong);
  if (baseline == null || solid == null || strong == null) return null;

  if (marker.direction === 'lower_better') {
    if (comparableValue <= strong) return 'strong';
    if (comparableValue <= solid) return 'solid';
    if (comparableValue <= baseline) return 'baseline';
    return 'below_baseline';
  }
  if (comparableValue >= strong) return 'strong';
  if (comparableValue >= solid) return 'solid';
  if (comparableValue >= baseline) return 'baseline';
  return 'below_baseline';
}

/** Marker #10 (shoulder flexion) has exactly 3 named qualitative levels in the PDF — no numeric "below baseline" tier is defined, so an unmatched answer is left unclassified rather than assumed. */
export function classifyQualitativeResult(
  marker: TestingMarker,
  valueText: string,
): MarkerTier | null {
  if (valueText === marker.strong) return 'strong';
  if (valueText === marker.solid) return 'solid';
  if (valueText === marker.baseline) return 'baseline';
  return null;
}

/** Marker #7's baseline/solid/strong are expressed as "x bodyweight" ratios — classification requires a known bodyweight, and returns null (never a guess) when the athlete hasn't recorded one. */
export function classifyE1rmResult(
  marker: TestingMarker,
  e1rmLb: number,
  bodyweightLb: number | null,
): MarkerTier | null {
  if (bodyweightLb == null || bodyweightLb <= 0) return null;
  return classifyNumericResult(marker, e1rmLb / bodyweightLb);
}

export function tierLabel(tier: MarkerTier | null): string {
  switch (tier) {
    case 'strong':
      return 'Strong';
    case 'solid':
      return 'Solid';
    case 'baseline':
      return 'Baseline';
    case 'below_baseline':
      return 'Below baseline';
    default:
      return 'Not classified';
  }
}

// ---------------------------------------------------------------------------
// e1RM formula (identical formula/rounding convention as
// src/features/loadCalculator and onboarding's starting-maxes screen: heavy
// set of 5 @ RIR 1 × 1.15, rounded to the nearest 5 lb — see
// data/program/*.json testing.longevityTen marker #7 `formula`.)
// ---------------------------------------------------------------------------

export function computeE1rmFromHeavy5(heavy5Weight: number): number {
  return Math.round((heavy5Weight * 1.15) / 5) * 5;
}

// ---------------------------------------------------------------------------
// Directionality-aware change description for Progress screens
// ---------------------------------------------------------------------------

export type ChangeDirection = 'improved' | 'declined' | 'unchanged';

export interface MarkerChange {
  absoluteChange: number;
  /** Null when a percentage is not mathematically meaningful (baseline of 0, or a qualitative marker). */
  percentChange: number | null;
  direction: ChangeDirection;
}

export function describeNumericChange(
  marker: TestingMarker,
  from: number,
  to: number,
): MarkerChange {
  const absoluteChange = to - from;
  const percentChange = from !== 0 ? (absoluteChange / Math.abs(from)) * 100 : null;
  let direction: ChangeDirection;
  if (to === from) direction = 'unchanged';
  else if (marker.direction === 'lower_better') direction = to < from ? 'improved' : 'declined';
  else direction = to > from ? 'improved' : 'declined';
  return { absoluteChange, percentChange, direction };
}
