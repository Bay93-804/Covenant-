import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card } from '../../src/design-system';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { programStartDateSchema } from '../../src/features/onboarding/schema';

function nextNMondays(n: number): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Advance to the next Monday (or today, if today is already Monday).
  const diffToMonday = (8 - cursor.getDay()) % 7;
  cursor.setDate(cursor.getDate() + diffToMonday);

  for (let i = 0; i < n; i += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function formatLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ProgramStartDateScreen() {
  const { data, update } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const mondayOptions = useMemo(() => nextNMondays(6), []);

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
      <View className="gap-3">
        {mondayOptions.map((iso) => {
          const selected = data.programStartDate === iso;
          return (
            <Pressable
              key={iso}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => update({ programStartDate: iso })}
            >
              <Card emphasized={selected} className="flex-row items-center justify-between">
                <AppText variant="body" color="primary" weight="600">
                  {formatLabel(iso)}
                </AppText>
                {selected ? (
                  <AppText variant="body" color="accent">
                    ✓
                  </AppText>
                ) : null}
              </Card>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginTop: 12 }}>
          {error}
        </AppText>
      ) : null}
      <AppText variant="caption" color="muted" style={{ marginTop: 16 }}>
        See docs/phase1/EXTRACTION_AUDIT.md #10 — the source program doesn&apos;t specify a start
        weekday, so we constrain it to Mondays for schedule clarity.
      </AppText>
    </OnboardingStepScreen>
  );
}
