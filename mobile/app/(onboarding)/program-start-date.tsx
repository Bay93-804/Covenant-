import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppText, DatePickerField } from '../../src/design-system';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { programStartDateSchema } from '../../src/features/onboarding/schema';

const MAX_MONTHS_OUT = 12;

export default function ProgramStartDateScreen() {
  const { data, update } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const maxDate = useMemo(() => {
    const date = new Date(today);
    date.setMonth(date.getMonth() + MAX_MONTHS_OUT);
    return date;
  }, [today]);

  function handleChange(iso: string) {
    update({ programStartDate: iso });
    setError(null);
  }

  function handleNext() {
    const result = programStartDateSchema.safeParse(data.programStartDate);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Choose a valid start date.');
      return;
    }
    setError(null);
    router.push('/(onboarding)/week0-testing-intro');
  }

  return (
    <OnboardingStepScreen
      step="program-start-date"
      title="Choose your Week 1 start date"
      subtitle="Week 1 always begins on a Monday. Week 0 baseline testing happens in the days before this date."
      onNext={handleNext}
    >
      <DatePickerField
        label="Program start date"
        required
        value={data.programStartDate}
        onChange={handleChange}
        minimumDate={today}
        maximumDate={maxDate}
        error={error ?? undefined}
        hint="Pick any date — it must land on a Monday."
      />

      <AppText variant="caption" color="muted" style={{ marginTop: 4 }}>
        See docs/phase1/EXTRACTION_AUDIT.md #10 — the source program doesn&apos;t specify a start
        weekday, so we constrain it to Mondays for schedule clarity. The native picker doesn&apos;t
        support restricting selectable weekdays, so pick a date and we&apos;ll confirm it&apos;s a
        Monday before continuing.
      </AppText>
    </OnboardingStepScreen>
  );
}
