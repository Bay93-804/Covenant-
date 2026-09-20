import { router } from 'expo-router';

import { AppText, TextField } from '../../src/design-system';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import type { estimatedMaxSchema } from '../../src/features/onboarding/schema';
import type { z } from 'zod';

type EstimatedMax = z.infer<typeof estimatedMaxSchema>;

const liftLabels: Record<EstimatedMax['liftKey'], string> = {
  trap_bar_deadlift: 'Trap-Bar Deadlift',
  back_squat: 'Back Squat',
  bench_press: 'Bench Press',
};

export default function StartingMaxesScreen() {
  const { data, update } = useOnboarding();

  function setMax(liftKey: EstimatedMax['liftKey'], text: string) {
    const numeric = text.trim() === '' ? undefined : Number(text);
    const next = data.estimatedMaxes.map((m) =>
      m.liftKey === liftKey ? { ...m, estimated1RM: numeric } : m,
    );
    update({ estimatedMaxes: next });
  }

  return (
    <OnboardingStepScreen
      step="starting-maxes"
      title="Starting estimated maxes"
      subtitle="Optional. Percentage-based lifts use these — capped at 80%, no true 1RM testing, ever. Leave any blank and estimate later from a heavy set of 5."
      onNext={() => router.push('/(onboarding)/notification-setup')}
    >
      {data.estimatedMaxes.map((max) => (
        <TextField
          key={max.liftKey}
          label={`${liftLabels[max.liftKey]} (${data.unitsWeight})`}
          keyboardType="numeric"
          value={max.estimated1RM?.toString() ?? ''}
          onChangeText={(v) => setMax(max.liftKey, v)}
          placeholder="e.g. 185"
        />
      ))}
      <AppText variant="caption" color="muted">
        Method: heavy set of 5 at RIR 1, × 1.15, rounded to the nearest 5 lb.
      </AppText>
    </OnboardingStepScreen>
  );
}
