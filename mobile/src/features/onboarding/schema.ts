/**
 * Zod validation for every onboarding field required by Phase 2 scope:
 * name, DOB, units, Week 1 Start Date, equipment, training experience,
 * injury/movement warnings, recent-sprint history, Week 0 sprint-test
 * deferral, estimated lift maxes, and notification preferences.
 */
import { z } from 'zod';

import { getDefaultWeek1StartDate, toIsoDateLocal } from './weekOneStartDate';

export const equipmentOptions = [
  { value: 'trap_bar', label: 'Trap bar' },
  { value: 'barbell', label: 'Barbell & plates' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bench', label: 'Bench' },
  { value: 'pull_up_bar', label: 'Pull-up bar' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'hill_or_sled', label: 'Hill or sled' },
  { value: 'med_ball', label: 'Med ball' },
  { value: 'hurdles_or_cones', label: 'Hurdles or cones' },
  { value: 'bodyweight_only', label: 'Bodyweight only' },
] as const;

export const equipmentValueSchema = z.enum(
  equipmentOptions.map((o) => o.value) as [string, ...string[]],
);

export const trainingExperienceOptions = [
  { value: 'new', label: 'New to structured training' },
  { value: 'returning', label: 'Returning after a break' },
  { value: 'experienced', label: 'Experienced / currently training' },
] as const;

export const trainingExperienceSchema = z.enum(['new', 'returning', 'experienced']);

export const weightUnitSchema = z.enum(['lb', 'kg']);
export const distanceUnitSchema = z.enum(['mi', 'km']);

/** DOB must be a real past date and imply an athlete at least 13 years old. */
export const dateOfBirthSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .refine((v) => {
    const dob = new Date(v);
    const minAgeCutoff = new Date();
    minAgeCutoff.setFullYear(minAgeCutoff.getFullYear() - 13);
    return dob <= minAgeCutoff;
  }, 'You must be at least 13 years old.')
  .optional()
  .or(z.literal(''));

/**
 * Week 1 Start Date: required, today or later, and constrained to Mondays
 * — see docs/phase1/EXTRACTION_AUDIT.md #10 (RESOLVED), an app scheduling/
 * UX decision the source PDF leaves open, not a program-content change.
 * Week 0 baseline testing happens in the days before this date; this date
 * itself is Week 1's Monday. The athlete may pick any upcoming Monday
 * (including one sooner than the recommended default) — this schema only
 * enforces "a real date, in the future, that's a Monday"; the recommended
 * ≥7-day lead time is a soft default + warning, not a hard minimum (see
 * src/features/onboarding/weekOneStartDate.ts).
 */
export const week1StartDateSchema = z
  .string()
  .min(1, 'Choose a Week 1 Start Date.')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date.')
  .refine((v) => {
    const date = new Date(`${v}T00:00:00`);
    return date.getDay() === 1; // Monday
  }, 'Week 1 Start Date must be a Monday — Week 1 always begins on Monday.')
  .refine((v) => {
    const date = new Date(`${v}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  }, "Week 1 Start Date can't be in the past.");

export const liftKeySchema = z.enum(['trap_bar_deadlift', 'back_squat', 'bench_press']);

export const estimatedMaxSchema = z.object({
  liftKey: liftKeySchema,
  estimated1RM: z
    .number()
    .positive('Enter a positive number.')
    .max(
      1000,
      "That's higher than this program's percentage work is designed for — double-check it.",
    )
    .optional(),
});

export const notificationPreferencesSchema = z.object({
  amReminderEnabled: z.boolean(),
  amReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format.'),
  pmReminderEnabled: z.boolean(),
  pmReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format.'),
  readinessReminderEnabled: z.boolean(),
  testingReminderEnabled: z.boolean(),
});

export const onboardingSchema = z.object({
  // profile-setup
  displayName: z.string().trim().min(1, 'Enter your name.').max(80, 'Keep it under 80 characters.'),
  dateOfBirth: dateOfBirthSchema,
  unitsWeight: weightUnitSchema,
  unitsDistance: distanceUnitSchema,
  trainingExperience: trainingExperienceSchema,
  equipmentAvailable: z.array(equipmentValueSchema).min(1, 'Select at least one option.'),
  injuryNotes: z.string().max(1000, 'Keep it under 1000 characters.').optional().or(z.literal('')),

  // medical-clearance
  medicalClearanceAcknowledged: z.literal(true, {
    message: 'You must acknowledge this before continuing.',
  }),

  // program-start-date (field: "Week 1 Start Date")
  week1StartDate: week1StartDateSchema,

  // week0-testing-intro
  hasSprintedRecently: z.boolean(),
  deferWeek0SprintTest: z.boolean(),

  // starting-maxes
  estimatedMaxes: z.array(estimatedMaxSchema),

  // notification-setup
  notificationPreferences: notificationPreferencesSchema,
});

export type OnboardingData = z.infer<typeof onboardingSchema>;

/**
 * Builds fresh onboarding defaults, including today-relative fields (the
 * Week 1 Start Date default — see weekOneStartDate.ts). A plain constant
 * object would freeze that date at module-import time instead of at the
 * moment onboarding actually starts, so this is a factory, not a constant.
 */
export function createDefaultOnboardingData(now: Date = new Date()): OnboardingData {
  return {
    displayName: '',
    dateOfBirth: '',
    unitsWeight: 'lb',
    unitsDistance: 'mi',
    trainingExperience: 'returning',
    equipmentAvailable: [],
    injuryNotes: '',
    medicalClearanceAcknowledged: false as unknown as true,
    week1StartDate: toIsoDateLocal(getDefaultWeek1StartDate(now)),
    hasSprintedRecently: true,
    deferWeek0SprintTest: false,
    estimatedMaxes: [
      { liftKey: 'trap_bar_deadlift', estimated1RM: undefined },
      { liftKey: 'back_squat', estimated1RM: undefined },
      { liftKey: 'bench_press', estimated1RM: undefined },
    ],
    notificationPreferences: {
      amReminderEnabled: true,
      amReminderTime: '06:30',
      pmReminderEnabled: true,
      pmReminderTime: '17:30',
      readinessReminderEnabled: true,
      testingReminderEnabled: true,
    },
  };
}
