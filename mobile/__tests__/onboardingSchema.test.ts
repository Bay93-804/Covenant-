import {
  defaultOnboardingData,
  onboardingSchema,
  programStartDateSchema,
} from '../src/features/onboarding/schema';

function nextMonday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const diff = (8 - date.getDay()) % 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function validOnboardingData() {
  return {
    ...defaultOnboardingData,
    displayName: 'Alex Athlete',
    equipmentAvailable: ['bodyweight_only'],
    medicalClearanceAcknowledged: true as const,
    programStartDate: nextMonday(),
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
      dateOfBirth: tooYoung.toISOString().slice(0, 10),
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
        ...defaultOnboardingData.notificationPreferences,
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

describe('program start date schema (Week 1 must start on a Monday)', () => {
  it('accepts the next upcoming Monday', () => {
    expect(programStartDateSchema.safeParse(nextMonday()).success).toBe(true);
  });

  it('rejects a non-Monday date', () => {
    const monday = new Date(`${nextMonday()}T00:00:00`);
    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const result = programStartDateSchema.safeParse(tuesday.toISOString().slice(0, 10));
    expect(result.success).toBe(false);
  });

  it('rejects a date in the past', () => {
    const pastMonday = new Date(`${nextMonday()}T00:00:00`);
    pastMonday.setDate(pastMonday.getDate() - 7);
    const result = programStartDateSchema.safeParse(pastMonday.toISOString().slice(0, 10));
    expect(result.success).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(programStartDateSchema.safeParse('').success).toBe(false);
  });
});
