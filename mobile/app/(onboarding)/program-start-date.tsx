import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { AppText, Card, DatePickerField } from '../../src/design-system';
import { getTestingEvent } from '../../src/content';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { week1StartDateSchema } from '../../src/features/onboarding/schema';
import {
  getEarliestSelectableMonday,
  isEarlierThanRecommended,
  MIN_RECOMMENDED_LEAD_DAYS,
} from '../../src/features/onboarding/weekOneStartDate';

const MAX_MONTHS_OUT = 12;

export default function ProgramStartDateScreen() {
  const { data, update } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const week0 = getTestingEvent('week0');

  const minDate = useMemo(() => getEarliestSelectableMonday(), []);

  const maxDate = useMemo(() => {
    const date = new Date(minDate);
    date.setMonth(date.getMonth() + MAX_MONTHS_OUT);
    return date;
  }, [minDate]);

  const showEarlyWarning =
    Boolean(data.week1StartDate) && isEarlierThanRecommended(data.week1StartDate);

  function handleChange(iso: string) {
    update({ week1StartDate: iso });
    setError(null);
  }

  function handleNext() {
    const result = week1StartDateSchema.safeParse(data.week1StartDate);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Choose a valid Week 1 Start Date.');
      return;
    }
    setError(null);
    router.push('/(onboarding)/week0-testing-intro');
  }

  return (
    <OnboardingStepScreen
      step="program-start-date"
      title="Choose your Week 1 Start Date"
      subtitle="Week 1 always begins on a Monday. Week 0 baseline testing begins right after you finish setup, in the days before this date."
      onNext={handleNext}
    >
      <DatePickerField
        label="Week 1 Start Date"
        required
        value={data.week1StartDate}
        onChange={handleChange}
        minimumDate={minDate}
        maximumDate={maxDate}
        error={error ?? undefined}
        hint={`Pick any date — it must land on a Monday. We suggest at least ${MIN_RECOMMENDED_LEAD_DAYS} days out so Week 0 has room to happen.`}
      />

      {showEarlyWarning ? (
        <Card emphasized className="mb-2">
          <AppText variant="caption" color="accent" style={{ marginBottom: 6 }}>
            HEADS UP — THIS IS SOONER THAN WE&apos;D RECOMMEND
          </AppText>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 8 }}>
            Before this date, Week 0 baseline testing ({week0.markers.length} markers total) still
            needs:
          </AppText>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 4 }}>
            • {week0.schedulingRules.restingHeartRate}
          </AppText>
          <AppText variant="bodySm" color="primary" style={{ marginBottom: 8 }}>
            • {week0.schedulingRules.athleticFive}
          </AppText>
          <AppText variant="bodySm" color="secondary">
            Make sure you can realistically fit all of that in before this date.
          </AppText>
        </Card>
      ) : null}

      <AppText variant="caption" color="muted" style={{ marginTop: 4 }}>
        See docs/phase1/EXTRACTION_AUDIT.md #10 (resolved as an app scheduling/UX decision) — the
        source program doesn&apos;t specify a start weekday, so we constrain Week 1 to Mondays for
        schedule clarity. The native picker doesn&apos;t support restricting selectable weekdays, so
        pick a date and we&apos;ll confirm it&apos;s a Monday before continuing.
      </AppText>
    </OnboardingStepScreen>
  );
}
