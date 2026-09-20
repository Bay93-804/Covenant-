import {
  createDefaultOnboardingData,
  onboardingSchema,
  week1StartDateSchema,
} from '../src/features/onboarding/schema';
import {
  getDefaultWeek1StartDate,
  getEarliestSelectableMonday,
  isEarlierThanRecommended,
  MIN_RECOMMENDED_LEAD_DAYS,
  nextMondayOnOrAfter,
  toIsoDateLocal,
} from '../src/features/onboarding/weekOneStartDate';

// Local-time (never toISOString/UTC) Monday helper for building test fixtures.
function nextMonday(): string {
  return toIsoDateLocal(nextMondayOnOrAfter(new Date()));
}

function validOnboardingData() {
  return {
    ...createDefaultOnboardingData(),
    displayName: 'Alex Athlete',
    equipmentAvailable: ['bodyweight_only'],
    medicalClearanceAcknowledged: true as const,
    week1StartDate: nextMonday(),
  };
}

describe('onboarding schema', () => {
  it('accepts a fully valid submission', () => {
    const result = onboardingSchema.safeParse(validOnboardingData());
    expect(result.success).toBe(true);
  });

  it('rejects an empty display name', () => {
    const result = onboardingSchema.safeParse({ ...validOnboardingData(), displayName: '  ' });
    expect(result.success).toBe(false);
  });

  it('rejects a submission missing medical clearance acknowledgement', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboardingData(),
      medicalClearanceAcknowledged: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty equipment selection', () => {
    const result = onboardingSchema.safeParse({ ...validOnboardingData(), equipmentAvailable: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a date of birth implying age under 13', () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 5);
    const result = onboardingSchema.safeParse({
      ...validOnboardingData(),
      dateOfBirth: toIsoDateLocal(tooYoung),
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty date of birth (optional field)', () => {
    const result = onboardingSchema.safeParse({ ...validOnboardingData(), dateOfBirth: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed reminder time', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboardingData(),
      notificationPreferences: {
        ...createDefaultOnboardingData().notificationPreferences,
        amReminderTime: '6:30am',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an estimated max above the sanity ceiling', () => {
    const result = onboardingSchema.safeParse({
      ...validOnboardingData(),
      estimatedMaxes: [{ liftKey: 'back_squat', estimated1RM: 5000 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createDefaultOnboardingData', () => {
  it('defaults Week 1 Start Date to a Monday at least MIN_RECOMMENDED_LEAD_DAYS out', () => {
    const data = createDefaultOnboardingData();
    const result = week1StartDateSchema.safeParse(data.week1StartDate);
    expect(result.success).toBe(true);
    expect(data.week1StartDate).toBe(toIsoDateLocal(getDefaultWeek1StartDate()));
    expect(isEarlierThanRecommended(data.week1StartDate)).toBe(false);
  });
});

describe('Week 1 Start Date schema (must start on a Monday) — EXTRACTION_AUDIT.md #10', () => {
  it('accepts the next upcoming Monday', () => {
    expect(week1StartDateSchema.safeParse(nextMonday()).success).toBe(true);
  });

  it('accepts the recommended (≥7-day-out) default', () => {
    const recommended = toIsoDateLocal(getDefaultWeek1StartDate());
    expect(week1StartDateSchema.safeParse(recommended).success).toBe(true);
  });

  it('accepts an earlier upcoming Monday than the recommended default', () => {
    const earliest = toIsoDateLocal(getEarliestSelectableMonday());
    expect(week1StartDateSchema.safeParse(earliest).success).toBe(true);
  });

  it('rejects a non-Monday date', () => {
    const monday = new Date(`${nextMonday()}T00:00:00`);
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const result = week1StartDateSchema.safeParse(toIsoDateLocal(tuesday));
    expect(result.success).toBe(false);
  });

  it('rejects a date in the past', () => {
    const pastMonday = new Date(`${nextMonday()}T00:00:00`);
    pastMonday.setDate(pastMonday.getDate() - 7);
    const result = week1StartDateSchema.safeParse(toIsoDateLocal(pastMonday));
    expect(result.success).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(week1StartDateSchema.safeParse('').success).toBe(false);
  });
});

describe('weekOneStartDate helpers (local-timezone Monday math)', () => {
  it('nextMondayOnOrAfter returns the same date when already a Monday', () => {
    // 2026-09-21 is a Monday.
    const monday = new Date(2026, 8, 21);
    expect(toIsoDateLocal(nextMondayOnOrAfter(monday))).toBe('2026-09-21');
  });

  it('nextMondayOnOrAfter advances a non-Monday to the following Monday', () => {
    // 2026-09-23 is a Wednesday -> next Monday is 2026-09-28.
    const wednesday = new Date(2026, 8, 23);
    expect(toIsoDateLocal(nextMondayOnOrAfter(wednesday))).toBe('2026-09-28');
  });

  it('toIsoDateLocal formats using local date parts, not UTC (no day-shift near midnight)', () => {
    const date = new Date(2026, 0, 5, 23, 30); // Jan 5, 2026, 11:30pm local
    expect(toIsoDateLocal(date)).toBe('2026-01-05');
  });

  it('getDefaultWeek1StartDate is a Monday at least MIN_RECOMMENDED_LEAD_DAYS days from "now"', () => {
    const now = new Date(2026, 8, 23); // Wednesday, Sept 23, 2026
    const result = getDefaultWeek1StartDate(now);
    expect(result.getDay()).toBe(1); // Monday
    const diffDays = Math.round((result.getTime() - now.getTime()) / 86_400_000);
    expect(diffDays).toBeGreaterThanOrEqual(MIN_RECOMMENDED_LEAD_DAYS);
    expect(diffDays).toBeLessThan(MIN_RECOMMENDED_LEAD_DAYS + 7);
  });

  it('getEarliestSelectableMonday can be sooner than the recommended default', () => {
    const now = new Date(2026, 8, 23); // Wednesday
    const earliest = getEarliestSelectableMonday(now);
    const recommended = getDefaultWeek1StartDate(now);
    expect(earliest.getDay()).toBe(1);
    expect(earliest.getTime()).toBeLessThan(recommended.getTime());
  });

  it('isEarlierThanRecommended flags an earlier Monday and clears the recommended one', () => {
    const now = new Date(2026, 8, 23);
    const earliest = toIsoDateLocal(getEarliestSelectableMonday(now));
    const recommended = toIsoDateLocal(getDefaultWeek1StartDate(now));
    expect(isEarlierThanRecommended(earliest, now)).toBe(true);
    expect(isEarlierThanRecommended(recommended, now)).toBe(false);
  });
});
