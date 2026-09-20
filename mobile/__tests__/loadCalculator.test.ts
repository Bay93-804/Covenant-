import {
  calculateRecommendedLoad,
  estimateOneRepMaxFromHeavyFive,
  roundToIncrement,
} from '../src/features/loadCalculator/loadCalculator';

describe('roundToIncrement', () => {
  it('rounds pounds to the nearest 5', () => {
    expect(roundToIncrement(182, 'lb')).toBe(180);
    expect(roundToIncrement(183, 'lb')).toBe(185);
    expect(roundToIncrement(186, 'lb')).toBe(185);
  });

  it('rounds kilograms to the nearest 2.5', () => {
    expect(roundToIncrement(81, 'kg')).toBe(80);
    expect(roundToIncrement(82, 'kg')).toBe(82.5);
    expect(roundToIncrement(83.5, 'kg')).toBe(82.5);
  });
});

describe('estimateOneRepMaxFromHeavyFive', () => {
  it('multiplies a heavy set-of-5-at-RIR1 weight by 1.15', () => {
    expect(estimateOneRepMaxFromHeavyFive(200)).toBeCloseTo(230);
  });
});

describe('calculateRecommendedLoad', () => {
  it('computes a straightforward percentage load, rounded', () => {
    const result = calculateRecommendedLoad({
      estimated1Rm: 230,
      prescribedPercentage: 65,
      unit: 'lb',
    });
    expect(result.rawLoad).toBeCloseTo(149.5);
    expect(result.recommendedLoad).toBe(150);
    expect(result.wasCapped).toBe(false);
  });

  it('never recommends above the program-wide 80% cap, even if asked for more', () => {
    const result = calculateRecommendedLoad({
      estimated1Rm: 200,
      prescribedPercentage: 95,
      unit: 'lb',
    });
    expect(result.effectivePercentage).toBe(80);
    expect(result.wasCapped).toBe(true);
    expect(result.recommendedLoad).toBe(160);
  });

  it('is not capped exactly at 80%', () => {
    const result = calculateRecommendedLoad({
      estimated1Rm: 200,
      prescribedPercentage: 80,
      unit: 'lb',
    });
    expect(result.wasCapped).toBe(false);
    expect(result.effectivePercentage).toBe(80);
  });

  it('rounds to the nearest kg increment when unit is kg', () => {
    const result = calculateRecommendedLoad({
      estimated1Rm: 100,
      prescribedPercentage: 72,
      unit: 'kg',
    });
    // raw = 72, already on a 2.5kg increment boundary is not guaranteed; check rounding.
    expect(result.recommendedLoad % 2.5).toBe(0);
  });
});
