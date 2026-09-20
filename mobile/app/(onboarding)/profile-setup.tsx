import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { ChoiceGroup, DatePickerField, TextField } from '../../src/design-system';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import {
  equipmentOptions,
  onboardingSchema,
  trainingExperienceOptions,
} from '../../src/features/onboarding/schema';

const stepSchema = onboardingSchema.pick({
  displayName: true,
  dateOfBirth: true,
  unitsWeight: true,
  unitsDistance: true,
  trainingExperience: true,
  equipmentAvailable: true,
  injuryNotes: true,
});

// Mirrors the 13-year minimum age enforced by `dateOfBirthSchema` in
// src/features/onboarding/schema.ts — these are just the picker's UI
// bounds, the Zod schema remains the source of truth for validation.
const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 100;

export default function ProfileSetupScreen() {
  const { data, update } = useOnboarding();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dobMaxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MIN_AGE_YEARS);
    return date;
  }, []);
  const dobMinDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MAX_AGE_YEARS);
    return date;
  }, []);

  function handleNext() {
    const result = stepSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    router.push('/(onboarding)/medical-clearance');
  }

  function toggleEquipment(value: string) {
    const current = data.equipmentAvailable;
    const next = current.includes(value as never)
      ? current.filter((v) => v !== value)
      : [...current, value as never];
    update({ equipmentAvailable: next });
  }

  return (
    <OnboardingStepScreen
      step="profile-setup"
      title="Tell us about you"
      subtitle="This shapes how your program is presented — never the prescriptions themselves."
      onNext={handleNext}
    >
      <TextField
        label="Name"
        required
        value={data.displayName}
        onChangeText={(v) => update({ displayName: v })}
        error={errors.displayName}
        autoCapitalize="words"
      />
      <DatePickerField
        label="Date of birth"
        value={data.dateOfBirth ?? ''}
        onChange={(v) => update({ dateOfBirth: v })}
        error={errors.dateOfBirth}
        hint="Optional."
        minimumDate={dobMinDate}
        maximumDate={dobMaxDate}
      />

      <ChoiceGroup
        label="Weight units"
        required
        options={[
          { value: 'lb', label: 'Pounds (lb)' },
          { value: 'kg', label: 'Kilograms (kg)' },
        ]}
        value={data.unitsWeight}
        onChange={(v) => update({ unitsWeight: v })}
      />
      <ChoiceGroup
        label="Distance units"
        required
        options={[
          { value: 'mi', label: 'Miles' },
          { value: 'km', label: 'Kilometers' },
        ]}
        value={data.unitsDistance}
        onChange={(v) => update({ unitsDistance: v })}
      />

      <ChoiceGroup
        label="Training experience"
        required
        options={trainingExperienceOptions as unknown as { value: string; label: string }[]}
        value={data.trainingExperience}
        onChange={(v) => update({ trainingExperience: v as typeof data.trainingExperience })}
      />

      <ChoiceGroup
        label="Equipment available"
        required
        multi
        error={errors.equipmentAvailable}
        options={equipmentOptions as unknown as { value: string; label: string }[]}
        value={data.equipmentAvailable}
        onChange={toggleEquipment}
      />

      <TextField
        label="Injuries or movement warnings"
        value={data.injuryNotes}
        onChangeText={(v) => update({ injuryNotes: v })}
        error={errors.injuryNotes}
        placeholder="e.g. Left knee sensitive to deep flexion"
        hint="Optional — helps you remember to flag it during readiness checks."
        multiline
        numberOfLines={3}
        style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }}
      />
    </OnboardingStepScreen>
  );
}
