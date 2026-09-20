import { router } from 'expo-router';
import { useState } from 'react';

import { AppText, Card, TextField, ToggleRow } from '../../src/design-system';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { onboardingSchema } from '../../src/features/onboarding/schema';
import { useAuth } from '../../src/lib/auth/AuthContext';
import { completeOnboarding } from '../../src/lib/onboarding/onboardingService';

export default function NotificationSetupScreen() {
  const { data, update } = useOnboarding();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const prefs = data.notificationPreferences;

  function patchPrefs(patch: Partial<typeof prefs>) {
    update({ notificationPreferences: { ...prefs, ...patch } });
  }

  async function handleFinish() {
    const result = onboardingSchema.safeParse(data);
    if (!result.success) {
      setError(
        `Something earlier in onboarding needs a fix: ${result.error.issues[0]?.message ?? 'please check your answers.'}`,
      );
      return;
    }
    if (!user) {
      setError('You must be signed in to finish onboarding.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await completeOnboarding(user.id, result.data);
      router.replace('/(tabs)/today');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your program. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingStepScreen
      step="notification-setup"
      title="Stay on schedule"
      subtitle="You can change these any time from Profile."
      onNext={handleFinish}
      nextLabel="Finish Setup"
      nextLoading={submitting}
    >
      <Card className="mb-4">
        <ToggleRow
          label="AM session reminder"
          value={prefs.amReminderEnabled}
          onValueChange={(v) => patchPrefs({ amReminderEnabled: v })}
        />
        {prefs.amReminderEnabled ? (
          <TextField
            label="AM reminder time"
            value={prefs.amReminderTime}
            onChangeText={(v) => patchPrefs({ amReminderTime: v })}
            placeholder="06:30"
          />
        ) : null}
      </Card>

      <Card className="mb-4">
        <ToggleRow
          label="PM session reminder"
          value={prefs.pmReminderEnabled}
          onValueChange={(v) => patchPrefs({ pmReminderEnabled: v })}
        />
        {prefs.pmReminderEnabled ? (
          <TextField
            label="PM reminder time"
            value={prefs.pmReminderTime}
            onChangeText={(v) => patchPrefs({ pmReminderTime: v })}
            placeholder="17:30"
          />
        ) : null}
      </Card>

      <Card className="mb-4">
        <ToggleRow
          label="Readiness check reminder"
          description="A nudge before speed and strength sessions."
          value={prefs.readinessReminderEnabled}
          onValueChange={(v) => patchPrefs({ readinessReminderEnabled: v })}
        />
      </Card>

      <Card>
        <ToggleRow
          label="Testing reminders"
          description="Week 0, Week 6, and Week 12."
          value={prefs.testingReminderEnabled}
          onValueChange={(v) => patchPrefs({ testingReminderEnabled: v })}
        />
      </Card>

      {error ? (
        <AppText variant="bodySm" color="danger" style={{ marginTop: 16 }}>
          {error}
        </AppText>
      ) : null}
    </OnboardingStepScreen>
  );
}
