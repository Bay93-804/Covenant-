/**
 * Turns raw `testing_results` attempt rows into the single "selected/best
 * result" per marker (explicit, never silently inferred beyond what each
 * marker's own protocol specifies — see markerFormats.ts), and builds the
 * Week 0 vs Week 6 vs Week 12 comparisons the Progress/Testing screens need.
 *
 * Every classification and comparison here is computed from data the athlete
 * actually entered plus the program's own authoritative baseline/solid/
 * strong thresholds — nothing is fabricated, and anything not comparable
 * (missing, deferred, qualitative, a broken bodyweight-normalization input,
 * a bilateral marker with no source-backed left/right combination rule, or
 * a CMJ arm-swing method mismatch across events) is surfaced as
 * `null`/`isDeferred`/`noncomparableReason` rather than guessed.
 */
import { getTestingMarker } from '../../content/repository';
import type { TestingMarker } from '../../content/schema';
import {
  classifyE1rmResult,
  classifyNumericResult,
  classifyQualitativeResult,
  computeE1rmFromHeavy5,
  describeNumericChange,
  formatInchesAsFeetInches,
  formatSecondsAsMmSs,
  getMarkerInputKind,
  type MarkerChange,
  type MarkerTier,
} from './markerFormats';
import { isSprintDeferralRow } from './sprintDeferral';
import type { TestingEventKey, TestingResult } from './types';

/** Markers #4 and #9 carry one baseline/solid/strong scale but record left and right independently — the source PDF states no rule for combining them into a single result (see docs/phase1/EXTRACTION_AUDIT.md item 12), so they're never aggregated into one comparableValue/classification. */
const BILATERAL_NO_AGGREGATION_MARKERS = new Set([4, 9]);
const CMJ_MARKER_NUMBER = 13;

export interface BilateralMarkerInfo {
  left: number | null;
  right: number | null;
  leftClassification: MarkerTier | null;
  rightClassification: MarkerTier | null;
  /** Factual |left - right| — never itself classified or used to pick a "better" side. */
  difference: number | null;
}

export interface MarkerSummary {
  markerNumber: number;
  marker: TestingMarker;
  hasResult: boolean;
  isDeferred: boolean;
  /** Raw attempt rows (deferral sentinel excluded) — never dropped, always available for the marker-history screen. */
  attempts: TestingResult[];
  /** Unit-normalized comparable number (seconds, inches, bpm, score, or e1RM weight) for classification/charts. Null when not comparable, including for bilateral markers with no combination rule (see `bilateral` instead). */
  comparableValue: number | null;
  displayValue: string | null;
  classification: MarkerTier | null;
  notes: string | null;
  /** Present only for markers #4 and #9 — independent per-side values/classification, since no source-backed combination rule exists. */
  bilateral: BilateralMarkerInfo | null;
  /** Present only for marker #13 (CMJ) — the locked arm-swing method used for this result, if recorded. */
  methodUsed: string | null;
}

export function formatComparableValue(marker: TestingMarker, value: number): string {
  if (marker.unit === 'mm:ss') return formatSecondsAsMmSs(value);
  if (marker.unit === 'ft-in') return formatInchesAsFeetInches(value);
  if (marker.unit === 'time') return value >= 60 ? formatSecondsAsMmSs(value) : `${round1(value)}s`;
  return `${round1(value)}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function numericValues(rows: TestingResult[]): number[] {
  return rows.map((r) => r.value_numeric).filter((v): v is number => v != null);
}

function buildBilateralInfo(
  marker: TestingMarker,
  left: number | null,
  right: number | null,
): BilateralMarkerInfo {
  return {
    left,
    right,
    leftClassification: left != null ? classifyNumericResult(marker, left) : null,
    rightClassification: right != null ? classifyNumericResult(marker, right) : null,
    difference: left != null && right != null ? round1(Math.abs(left - right)) : null,
  };
}

function formatBilateralDisplay(
  marker: TestingMarker,
  left: number | null,
  right: number | null,
): string | null {
  if (left == null && right == null) return null;
  const l = left != null ? formatComparableValue(marker, left) : '—';
  const r = right != null ? formatComparableValue(marker, right) : '—';
  return `L: ${l} · R: ${r}`;
}

export function summarizeMarkerResults(
  markerNumber: number,
  attempts: TestingResult[],
  options: { bodyweightLb?: number | null } = {},
): MarkerSummary {
  const marker = getTestingMarker(markerNumber);
  if (!marker) throw new Error(`Unknown marker #${markerNumber}`);
  const kind = getMarkerInputKind(markerNumber);

  const deferralRow = attempts.find(isSprintDeferralRow) ?? null;
  const realAttempts = attempts.filter((a) => !isSprintDeferralRow(a));
  const isDeferred = Boolean(deferralRow) && realAttempts.every((a) => a.value_numeric == null);

  let comparableValue: number | null = null;
  let displayValue: string | null = null;
  let bilateral: BilateralMarkerInfo | null = null;
  let methodUsed: string | null = null;

  switch (kind) {
    case 'mmss':
    case 'numeric':
    case 'time_flexible':
    case 'rhr_three_morning': {
      comparableValue = realAttempts[0]?.value_numeric ?? null;
      break;
    }
    case 'qualitative': {
      displayValue = realAttempts[0]?.value_text ?? null;
      break;
    }
    case 'sprint_10yd':
    case 'pro_agility': {
      const values = numericValues(realAttempts);
      comparableValue = values.length ? Math.min(...values) : null; // lower is better
      break;
    }
    case 'broad_jump': {
      const values = numericValues(realAttempts);
      comparableValue = values.length ? Math.max(...values) : null; // higher is better
      break;
    }
    case 'cmj': {
      const values = numericValues(realAttempts);
      comparableValue = values.length ? Math.max(...values) : null; // higher is better
      methodUsed =
        realAttempts.find((a) => a.value_text === 'hands_on_hips' || a.value_text === 'arm_swing')
          ?.value_text ?? null;
      break;
    }
    case 'deceleration_deficit': {
      const stop =
        realAttempts.find((a) => a.notes?.includes('sprint_and_stop'))?.value_numeric ?? null;
      const through =
        realAttempts.find((a) => a.notes?.includes('sprint_through'))?.value_numeric ?? null;
      comparableValue = stop != null && through != null ? round1(stop - through) : null;
      break;
    }
    case 'bilateral_time': {
      const left = realAttempts.find((a) => a.side === 'left')?.value_numeric ?? null;
      const right = realAttempts.find((a) => a.side === 'right')?.value_numeric ?? null;
      bilateral = buildBilateralInfo(marker, left, right);
      break;
    }
    case 'bilateral_attempts_time': {
      const leftBestVal = numericValues(realAttempts.filter((a) => a.side === 'left'));
      const rightBestVal = numericValues(realAttempts.filter((a) => a.side === 'right'));
      const leftBest = leftBestVal.length ? Math.max(...leftBestVal) : null;
      const rightBest = rightBestVal.length ? Math.max(...rightBestVal) : null;
      bilateral = buildBilateralInfo(marker, leftBest, rightBest);
      break;
    }
    case 'e1rm_heavy5': {
      const heavy5 = realAttempts[0]?.value_numeric ?? null;
      comparableValue = heavy5 != null ? computeE1rmFromHeavy5(heavy5) : null;
      break;
    }
  }

  let classification: MarkerTier | null = null;
  if (kind === 'qualitative') {
    classification = displayValue ? classifyQualitativeResult(marker, displayValue) : null;
  } else if (kind === 'e1rm_heavy5') {
    classification =
      comparableValue != null
        ? classifyE1rmResult(marker, comparableValue, options.bodyweightLb ?? null)
        : null;
  } else if (comparableValue != null) {
    classification = classifyNumericResult(marker, comparableValue);
  }

  if (bilateral) {
    displayValue = formatBilateralDisplay(marker, bilateral.left, bilateral.right);
  } else if (!displayValue && comparableValue != null) {
    displayValue = formatComparableValue(marker, comparableValue);
  }

  const hasResult = bilateral
    ? !isDeferred && (bilateral.left != null || bilateral.right != null)
    : !isDeferred && realAttempts.some((a) => a.value_numeric != null || a.value_text != null);

  const notes = realAttempts.map((a) => a.notes).find(Boolean) ?? null;

  return {
    markerNumber,
    marker,
    hasResult,
    isDeferred,
    attempts: realAttempts,
    comparableValue,
    displayValue,
    classification,
    notes,
    bilateral,
    methodUsed,
  };
}

export function summarizeSessionResults(
  markerNumbers: number[],
  allResults: TestingResult[],
  options: { bodyweightLb?: number | null } = {},
): Map<number, MarkerSummary> {
  const byMarker = new Map<number, TestingResult[]>();
  for (const row of allResults) {
    const list = byMarker.get(row.marker_number) ?? [];
    list.push(row);
    byMarker.set(row.marker_number, list);
  }
  const summaries = new Map<number, MarkerSummary>();
  for (const num of markerNumbers) {
    summaries.set(num, summarizeMarkerResults(num, byMarker.get(num) ?? [], options));
  }
  return summaries;
}

export type MarkerEntryState = 'not_started' | 'in_progress' | 'complete' | 'deferred';

export function markerEntryState(summary: MarkerSummary): MarkerEntryState {
  if (summary.isDeferred) return 'deferred';
  if (summary.hasResult) return 'complete';
  if (summary.attempts.length > 0) return 'in_progress';
  return 'not_started';
}

export function isEventFullyComplete(
  markerNumbers: number[],
  summaries: Map<number, MarkerSummary>,
): boolean {
  return markerNumbers.every((num) => {
    const state = summaries.get(num);
    return state ? state.hasResult || state.isDeferred : false;
  });
}

// ---------------------------------------------------------------------------
// Week 0 / Week 6 / Week 12 comparison
// ---------------------------------------------------------------------------

export interface MarkerComparison {
  markerNumber: number;
  marker: TestingMarker;
  week0: MarkerSummary | null;
  week6: MarkerSummary | null;
  week12: MarkerSummary | null;
  /** Which event actually supplied the earliest usable value for this marker — usually week0, but week6 for a deferred marker #11. */
  baselineEvent: TestingEventKey | null;
  changeToWeek12: MarkerChange | null;
  changeToWeek6: MarkerChange | null;
  /** Per-side changes for bilateral markers (#4, #9) — the only well-defined comparison when no source-backed combination rule exists. */
  changeToWeek12Left: MarkerChange | null;
  changeToWeek12Right: MarkerChange | null;
  changeToWeek6Left: MarkerChange | null;
  changeToWeek6Right: MarkerChange | null;
  /** Set whenever an overall (single-number) comparison is intentionally withheld — a bilateral marker with no aggregation rule, or a CMJ arm-swing method mismatch across events. Null when the ordinary changeToWeek12/changeToWeek6 fields already say everything there is to say. */
  noncomparableReason: string | null;
}

export function buildTestingComparison(
  markerResultsByEvent: Record<TestingEventKey, TestingResult[]>,
  options: { bodyweightLb?: number | null } = {},
): MarkerComparison[] {
  const week0Summaries = summarizeSessionResults(range(1, 15), markerResultsByEvent.week0, options);
  const week6Summaries = summarizeSessionResults(range(1, 15), markerResultsByEvent.week6, options);
  const week12Summaries = summarizeSessionResults(
    range(1, 15),
    markerResultsByEvent.week12,
    options,
  );

  const comparisons: MarkerComparison[] = [];
  for (let num = 1; num <= 15; num++) {
    const marker = getTestingMarker(num);
    if (!marker) continue;
    const week0 = week0Summaries.get(num) ?? null;
    const week6 = week6Summaries.get(num) ?? null;
    const week12 = week12Summaries.get(num) ?? null;

    // Marker #11: if Week 0 was deferred, Week 6's value is the effective
    // baseline (see docs/phase1/EXTRACTION_AUDIT.md #1 / testing.events —
    // the program itself defers the baseline measurement, not just the app).
    const week0IsUsableBaseline = week0?.comparableValue != null;
    const baselineSummary = week0IsUsableBaseline
      ? week0
      : num === 11 && week6?.comparableValue != null
        ? week6
        : null;
    const baselineEvent: TestingEventKey | null = week0IsUsableBaseline
      ? 'week0'
      : num === 11 && week6?.comparableValue != null
        ? 'week6'
        : null;

    let changeToWeek12: MarkerChange | null = null;
    let changeToWeek6: MarkerChange | null = null;
    let changeToWeek12Left: MarkerChange | null = null;
    let changeToWeek12Right: MarkerChange | null = null;
    let changeToWeek6Left: MarkerChange | null = null;
    let changeToWeek6Right: MarkerChange | null = null;
    let noncomparableReason: string | null = null;

    if (BILATERAL_NO_AGGREGATION_MARKERS.has(num)) {
      noncomparableReason =
        'The source program gives one scale but no rule for combining left and right into a single result — compared per side instead.';
      if (week0?.bilateral?.left != null && week12?.bilateral?.left != null) {
        changeToWeek12Left = describeNumericChange(
          marker,
          week0.bilateral.left,
          week12.bilateral.left,
        );
      }
      if (week0?.bilateral?.right != null && week12?.bilateral?.right != null) {
        changeToWeek12Right = describeNumericChange(
          marker,
          week0.bilateral.right,
          week12.bilateral.right,
        );
      }
      if (week0?.bilateral?.left != null && week6?.bilateral?.left != null) {
        changeToWeek6Left = describeNumericChange(
          marker,
          week0.bilateral.left,
          week6.bilateral.left,
        );
      }
      if (week0?.bilateral?.right != null && week6?.bilateral?.right != null) {
        changeToWeek6Right = describeNumericChange(
          marker,
          week0.bilateral.right,
          week6.bilateral.right,
        );
      }
    } else if (num === CMJ_MARKER_NUMBER) {
      const week0Method = week0?.methodUsed ?? null;
      const week12Method = week12?.methodUsed ?? null;
      const week6Method = week6?.methodUsed ?? null;

      if (week0Method && week12Method && week0Method !== week12Method) {
        noncomparableReason = `Arm-swing method changed between tests (${week0Method.replace(/_/g, ' ')} → ${week12Method.replace(/_/g, ' ')}) — not comparable.`;
      } else if (week0?.comparableValue != null && week12?.comparableValue != null) {
        changeToWeek12 = describeNumericChange(
          marker,
          week0.comparableValue,
          week12.comparableValue,
        );
      }

      if (week0Method && week6Method && week0Method !== week6Method) {
        noncomparableReason = noncomparableReason
          ? `${noncomparableReason} Week 6 also used a different method (${week6Method.replace(/_/g, ' ')}).`
          : `Arm-swing method changed by Week 6 (${week0Method.replace(/_/g, ' ')} → ${week6Method.replace(/_/g, ' ')}) — not comparable.`;
      } else if (week0?.comparableValue != null && week6?.comparableValue != null) {
        changeToWeek6 = describeNumericChange(marker, week0.comparableValue, week6.comparableValue);
      }
    } else {
      changeToWeek12 =
        baselineSummary?.comparableValue != null &&
        week12?.comparableValue != null &&
        kindIsNumericComparable(num)
          ? describeNumericChange(marker, baselineSummary.comparableValue, week12.comparableValue)
          : null;

      changeToWeek6 =
        week0?.comparableValue != null &&
        week6?.comparableValue != null &&
        kindIsNumericComparable(num) &&
        num !== 11
          ? describeNumericChange(marker, week0.comparableValue, week6.comparableValue)
          : null;
    }

    comparisons.push({
      markerNumber: num,
      marker,
      week0,
      week6,
      week12,
      baselineEvent,
      changeToWeek12,
      changeToWeek6,
      changeToWeek12Left,
      changeToWeek12Right,
      changeToWeek6Left,
      changeToWeek6Right,
      noncomparableReason,
    });
  }
  return comparisons;
}

function kindIsNumericComparable(markerNumber: number): boolean {
  return getMarkerInputKind(markerNumber) !== 'qualitative';
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}
