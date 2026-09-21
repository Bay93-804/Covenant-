import { getTestingMarker } from '../src/content/repository';
import {
  classifyE1rmResult,
  classifyNumericResult,
  classifyQualitativeResult,
  computeE1rmFromHeavy5,
  describeNumericChange,
  feetInchesToInches,
  formatInchesAsFeetInches,
  formatSecondsAsMmSs,
  getMarkerInputKind,
  parseFeetInchesString,
  parseFlexibleTime,
  parseMmSs,
} from '../src/features/testing/markerFormats';

describe('unit parsing', () => {
  it('parses mm:ss into total seconds', () => {
    expect(parseMmSs('13:00')).toBe(780);
    expect(parseMmSs('9:45')).toBe(585);
    expect(parseMmSs('2:00.5')).toBe(120.5);
  });

  it('rejects malformed mm:ss rather than guessing', () => {
    expect(parseMmSs('not a time')).toBeNull();
    expect(parseMmSs('13')).toBeNull();
  });

  it('round-trips seconds <-> mm:ss formatting', () => {
    expect(formatSecondsAsMmSs(780)).toBe('13:00');
    expect(parseMmSs(formatSecondsAsMmSs(585))).toBe(585);
  });

  it('parses the deep squat hold marker\'s two textual forms ("60s" and "2:00")', () => {
    expect(parseFlexibleTime('60s')).toBe(60);
    expect(parseFlexibleTime('2:00')).toBe(120);
    expect(parseFlexibleTime('45')).toBe(45);
  });

  it('parses and formats feet-inches', () => {
    expect(feetInchesToInches(6, 6)).toBe(78);
    expect(parseFeetInchesString(`6'6"`)).toBe(78);
    expect(formatInchesAsFeetInches(78)).toBe(`6'6"`);
  });
});

describe('marker input kinds', () => {
  it('assigns every one of the 15 markers an explicit, marker-specific input kind', () => {
    for (let num = 1; num <= 15; num++) {
      expect(() => getMarkerInputKind(num)).not.toThrow();
    }
  });
});

describe("classifyNumericResult (directionality-aware, against the program's own thresholds)", () => {
  it('lower_better: resting heart rate classifies down through baseline/solid/strong', () => {
    const rhr = getTestingMarker(1)!;
    expect(classifyNumericResult(rhr, 75)).toBe('below_baseline'); // worse than baseline (70)
    expect(classifyNumericResult(rhr, 70)).toBe('baseline');
    expect(classifyNumericResult(rhr, 62)).toBe('solid');
    expect(classifyNumericResult(rhr, 50)).toBe('strong');
  });

  it('higher_better: grip strength classifies up through baseline/solid/strong', () => {
    const grip = getTestingMarker(3)!;
    expect(classifyNumericResult(grip, 30)).toBe('below_baseline');
    expect(classifyNumericResult(grip, 45)).toBe('baseline');
    expect(classifyNumericResult(grip, 55)).toBe('solid');
    expect(classifyNumericResult(grip, 65)).toBe('strong');
  });

  it('parses mm:ss thresholds for the 1.5-mile run marker', () => {
    const run = getTestingMarker(2)!;
    expect(classifyNumericResult(run, 780)).toBe('baseline'); // 13:00
    expect(classifyNumericResult(run, 585)).toBe('strong'); // 9:45 or faster
  });

  it('parses ft-in thresholds for the broad jump marker', () => {
    const jump = getTestingMarker(12)!;
    expect(classifyNumericResult(jump, feetInchesToInches(6, 6))).toBe('baseline');
    expect(classifyNumericResult(jump, feetInchesToInches(8, 6))).toBe('strong');
  });
});

describe('classifyQualitativeResult', () => {
  it('matches marker #10 exact PDF phrases and never fabricates a below-baseline tier', () => {
    const shoulder = getTestingMarker(10)!;
    expect(classifyQualitativeResult(shoulder, String(shoulder.baseline))).toBe('baseline');
    expect(classifyQualitativeResult(shoulder, String(shoulder.solid))).toBe('solid');
    expect(classifyQualitativeResult(shoulder, String(shoulder.strong))).toBe('strong');
    expect(classifyQualitativeResult(shoulder, 'something else entirely')).toBeNull();
  });
});

describe('e1RM formula + bodyweight-normalized classification', () => {
  it('computes e1RM as heavy-5 weight x 1.15, rounded to the nearest 5', () => {
    expect(computeE1rmFromHeavy5(200)).toBe(230);
    expect(computeE1rmFromHeavy5(203)).toBe(235); // 233.45 rounds to nearest 5
  });

  it('never classifies without a known bodyweight', () => {
    const trapBar = getTestingMarker(7)!;
    expect(classifyE1rmResult(trapBar, 230, null)).toBeNull();
  });

  it('classifies the x-bodyweight ratio once bodyweight is known', () => {
    const trapBar = getTestingMarker(7)!;
    // 230 / 184 = 1.25x bodyweight -> exactly the baseline threshold.
    expect(classifyE1rmResult(trapBar, 230, 184)).toBe('baseline');
  });
});

describe('describeNumericChange', () => {
  it('computes absolute and percent change and directionality for a higher_better marker', () => {
    const grip = getTestingMarker(3)!;
    const change = describeNumericChange(grip, 45, 55);
    expect(change.absoluteChange).toBe(10);
    expect(change.percentChange).toBeCloseTo((10 / 45) * 100);
    expect(change.direction).toBe('improved');
  });

  it('computes directionality correctly for a lower_better marker', () => {
    const sprint = getTestingMarker(11)!;
    const change = describeNumericChange(sprint, 2.0, 1.8);
    expect(change.direction).toBe('improved'); // faster (lower) is better
    const worse = describeNumericChange(sprint, 1.8, 2.0);
    expect(worse.direction).toBe('declined');
  });

  it('never computes a percentage change from a zero baseline', () => {
    const sideDiff = getTestingMarker(9)!;
    const change = describeNumericChange(sideDiff, 0, 5);
    expect(change.percentChange).toBeNull();
  });

  it('reports "unchanged" when the value did not move', () => {
    const grip = getTestingMarker(3)!;
    const change = describeNumericChange(grip, 50, 50);
    expect(change.direction).toBe('unchanged');
  });
});
