import { detectMissedWeeks } from '../src/features/schedule/missedWeeks';
import { datesForWeek, type EnrollmentScheduleInput } from '../src/features/schedule/scheduleEngine';

const input: EnrollmentScheduleInput = {
  startDate: '2026-01-05', // Monday, Week 1 day 1
  timezone: 'America/New_York',
};

describe('detectMissedWeeks', () => {
  it('does not flag a week that has not fully elapsed yet', () => {
    const today = '2026-01-08'; // still inside week 1
    const result = detectMissedWeeks(input, today, new Set());
    expect(result.missedWeekNumbers).toEqual([]);
  });

  it('does not flag a fully elapsed week with at least one completed training day', () => {
    const [monday] = datesForWeek(input, 1);
    const today = '2026-01-15'; // week 1 fully elapsed
    const result = detectMissedWeeks(input, today, new Set([monday]));
    expect(result.missedWeekNumbers).toEqual([]);
  });

  it('flags a fully elapsed week with zero completed training days as missed', () => {
    const today = '2026-01-15';
    const result = detectMissedWeeks(input, today, new Set());
    expect(result.missedWeekNumbers).toEqual([1]);
    expect(result.shouldRecommendRestart).toBe(false);
  });

  it('recommends a restart at the current block start after two missed weeks', () => {
    const today = '2026-01-22'; // weeks 1 and 2 both fully elapsed
    const result = detectMissedWeeks(input, today, new Set());
    expect(result.missedWeekNumbers).toEqual([1, 2]);
    expect(result.shouldRecommendRestart).toBe(true);
    expect(result.restartBlockStartWeek).toBe(1); // Block 1 = weeks 1-4
  });

  it('recommends restarting Block 2 when the two missed weeks fall inside weeks 5-8', () => {
    const [week5Monday] = datesForWeek(input, 5);
    const [week1Monday] = datesForWeek(input, 1);
    const [week2Monday] = datesForWeek(input, 2);
    const [week3Monday] = datesForWeek(input, 3);
    const [week4Monday] = datesForWeek(input, 4);
    const today = datesForWeek(input, 7)[0]; // weeks up through 6 elapsed
    const completed = new Set([week1Monday, week2Monday, week3Monday, week4Monday]); // weeks 5 & 6 missed
    void week5Monday;
    const result = detectMissedWeeks(input, today, completed);
    expect(result.missedWeekNumbers).toEqual([5, 6]);
    expect(result.restartBlockStartWeek).toBe(5); // Block 2 = weeks 5-8
  });
});
