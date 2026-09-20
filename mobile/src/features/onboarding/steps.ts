export const onboardingSteps = [
  'welcome',
  'profile-setup',
  'medical-clearance',
  'program-start-date',
  'week0-testing-intro',
  'starting-maxes',
  'notification-setup',
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

export function stepIndex(step: OnboardingStep): number {
  return onboardingSteps.indexOf(step);
}
