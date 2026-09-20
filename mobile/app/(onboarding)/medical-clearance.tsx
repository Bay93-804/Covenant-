import { router } from 'expo-router';
import { useState } from 'react';

import { Card, Checkbox, AppText } from '../../src/design-system';
import { getProgramContent } from '../../src/content';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';

export default function MedicalClearanceScreen() {
  const { data, update } = useOnboarding();
  const content = getProgramContent();
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (!data.medicalClearanceAcknowledged) {
      setError('You must acknowledge this before continuing.');
      return;
    }
    setError(null);
    router.push('/(onboarding)/program-start-date');
  }

  return (
    <OnboardingStepScreen step="medical-clearance" title="Before you begin" onNext={handleNext}>
      <Card className="mb-6">
        <AppText variant="body" color="secondary">
          {content.meta.disclaimer}
        </AppText>
      </Card>

      <Checkbox
        label="I understand and have been medically cleared to begin this program."
        checked={data.medicalClearanceAcknowledged === true}
        onChange={(checked) => update({ medicalClearanceAcknowledged: checked as unknown as true })}
        error={error ?? undefined}
      />
    </OnboardingStepScreen>
  );
}
