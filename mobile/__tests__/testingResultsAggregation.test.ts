import type { TestingResult } from '../src/features/testing/types';
import {
  buildTestingComparison,
  isEventFullyComplete,
  markerEntryState,
  summarizeMarkerResults,
  summarizeSessionResults,
} from '../src/features/testing/testingResultsAggregation';

function result(overrides: Partial<TestingResult>): TestingResult {
  return {
    id: 'r-' + Math.random(),
    client_uuid: 'r',
    testing_session_id: 'session-1',
    user_id: 'user-1',
    marker_number: 1,
    attempt_number: 1,
    side: null,
    value_numeric: null,
    value_text: null,
    is_best_attempt: false,
    classification: null,
    notes: null,
    recorded_at: '2026-01-01T06:00:00.000Z',
    ...overrides,
  };
}

describe('summarizeMarkerResults: attempts + best-attempt selection', () => {
  it('sprint (#11): lowest of up to 3 attempts wins, since lower is better', () => {
    const attempts = [
      result({ marker_number: 11, attempt_number: 1, value_numeric: 2.1 }),
      result({ marker_number: 11, attempt_number: 2, value_numeric: 1.85 }),
      result({ marker_number: 11, attempt_number: 3, value_numeric: 1.95 }),
    ];
    const summary = summarizeMarkerResults(11, attempts);
    expect(summary.comparableValue).toBe(1.85);
    expect(summary.hasResult).toBe(true);
    expect(summary.isDeferred).toBe(false);
  });

  it('broad jump (#12): highest of up to 3 attempts wins, converted from feet/inches to inches', () => {
    const attempts = [
      result({ marker_number: 12, attempt_number: 1, value_numeric: 78 }), // 6'6"
      result({ marker_number: 12, attempt_number: 2, value_numeric: 92 }), // 7'8"
      result({ marker_number: 12, attempt_number: 3, value_numeric: 80 }),
    ];
    const summary = summarizeMarkerResults(12, attempts);
    expect(summary.comparableValue).toBe(92);
  });

  it('deceleration deficit (#15): computed from two tagged component attempts', () => {
    const attempts = [
      result({
        marker_number: 15,
        attempt_number: 1,
        value_numeric: 1.6,
        notes: 'sprint_and_stop_time_10yd',
      }),
      result({
        marker_number: 15,
        attempt_number: 2,
        value_numeric: 0.9,
        notes: 'sprint_through_time_10yd',
      }),
    ];
    const summary = summarizeMarkerResults(15, attempts);
    expect(summary.comparableValue).toBeCloseTo(0.7);
  });

  it('bilateral (#9 side plank): each side stored separately, classification uses the weaker side', () => {
    const attempts = [
      result({ marker_number: 9, attempt_number: 1, side: 'left', value_numeric: 90 }),
      result({ marker_number: 9, attempt_number: 1, side: 'right', value_numeric: 60 }),
    ];
    const summary = summarizeMarkerResults(9, attempts);
    expect(summary.comparableValue).toBe(60);
  });

  it('bilateral attempts (#4 balance eyes closed): best of 2 per side, then weaker side used', () => {
    const attempts = [
      result({ marker_number: 4, attempt_number: 1, side: 'left', value_numeric: 15 }),
      result({ marker_number: 4, attempt_number: 2, side: 'left', value_numeric: 22 }),
      result({ marker_number: 4, attempt_number: 1, side: 'right', value_numeric: 18 }),
    ];
    const summary = summarizeMarkerResults(4, attempts);
    // left best = 22, right best = 18 -> weaker side = 18
    expect(summary.comparableValue).toBe(18);
  });

  it('a deferred sprint marker is never presented as a real (below-baseline) result', () => {
    const attempts = [
      result({
        marker_number: 11,
        attempt_number: 0,
        value_numeric: null,
        value_text: 'deferred',
        notes: 'Not sprinted since youth',
      }),
    ];
    const summary = summarizeMarkerResults(11, attempts);
    expect(summary.isDeferred).toBe(true);
    expect(summary.hasResult).toBe(false);
    expect(summary.comparableValue).toBeNull();
  });

  it('e1RM (#7) is computed from the raw heavy-5 attempt and classification needs bodyweight', () => {
    const attempts = [result({ marker_number: 7, attempt_number: 1, value_numeric: 200 })];
    const withoutBodyweight = summarizeMarkerResults(7, attempts);
    expect(withoutBodyweight.comparableValue).toBe(230); // 200 * 1.15 rounded to nearest 5
    expect(withoutBodyweight.classification).toBeNull();

    const withBodyweight = summarizeMarkerResults(7, attempts, { bodyweightLb: 184 });
    expect(withBodyweight.classification).toBe('baseline');
  });

  it('missing data never fabricates a comparable value', () => {
    const summary = summarizeMarkerResults(2, []);
    expect(summary.comparableValue).toBeNull();
    expect(summary.hasResult).toBe(false);
    expect(summary.classification).toBeNull();
  });
});

describe('markerEntryState + isEventFullyComplete', () => {
  it('reflects not_started / in_progress / complete / deferred correctly', () => {
    const notStarted = summarizeMarkerResults(2, []);
    expect(markerEntryState(notStarted)).toBe('not_started');

    const inProgress = summarizeMarkerResults(11, [
      result({ marker_number: 11, attempt_number: 1, value_numeric: 2.0 }),
    ]);
    // one attempt of a 3-attempt marker still counts as "complete" since a
    // single valid attempt already yields a selected/best result.
    expect(markerEntryState(inProgress)).toBe('complete');

    const deferred = summarizeMarkerResults(11, [
      result({ marker_number: 11, attempt_number: 0, value_text: 'deferred' }),
    ]);
    expect(markerEntryState(deferred)).toBe('deferred');
  });

  it('a session is fully complete only once every marker has a result or is deferred', () => {
    const results: TestingResult[] = [
      result({ marker_number: 1, value_numeric: 60 }),
      result({ marker_number: 4, side: 'left', value_numeric: 20 }),
      result({ marker_number: 4, side: 'right', value_numeric: 18 }),
    ];
    const summaries = summarizeSessionResults([1, 4, 5], results);
    expect(isEventFullyComplete([1, 4, 5], summaries)).toBe(false); // marker 5 missing
    const summariesComplete = summarizeSessionResults(
      [1, 4],
      results.filter((r) => r.marker_number !== 5),
    );
    expect(isEventFullyComplete([1, 4], summariesComplete)).toBe(true);
  });
});

describe('buildTestingComparison', () => {
  it('compares Week 0 to Week 12 and reports honest directionality', () => {
    const comparison = buildTestingComparison({
      week0: [result({ marker_number: 3, value_numeric: 45 })],
      week6: [],
      week12: [result({ marker_number: 3, value_numeric: 55 })],
    });
    const grip = comparison.find((c) => c.markerNumber === 3)!;
    expect(grip.baselineEvent).toBe('week0');
    expect(grip.changeToWeek12?.direction).toBe('improved');
  });

  it('uses Week 6 as the effective baseline for marker #11 when Week 0 deferred it', () => {
    const comparison = buildTestingComparison({
      week0: [result({ marker_number: 11, attempt_number: 0, value_text: 'deferred' })],
      week6: [result({ marker_number: 11, attempt_number: 1, value_numeric: 2.0 })],
      week12: [result({ marker_number: 11, attempt_number: 1, value_numeric: 1.8 })],
    });
    const sprint = comparison.find((c) => c.markerNumber === 11)!;
    expect(sprint.baselineEvent).toBe('week6');
    expect(sprint.changeToWeek12?.direction).toBe('improved');
  });

  it('never comparable when data is missing at both ends', () => {
    const comparison = buildTestingComparison({ week0: [], week6: [], week12: [] });
    const anyMarker = comparison[0]!;
    expect(anyMarker.changeToWeek12).toBeNull();
    expect(anyMarker.baselineEvent).toBeNull();
  });

  it('qualitative marker #10 never gets a fabricated numeric change', () => {
    const comparison = buildTestingComparison({
      week0: [result({ marker_number: 10, value_text: 'Within 3"' })],
      week6: [],
      week12: [result({ marker_number: 10, value_text: 'Thumbs flat' })],
    });
    const shoulder = comparison.find((c) => c.markerNumber === 10)!;
    expect(shoulder.changeToWeek12).toBeNull();
  });
});
