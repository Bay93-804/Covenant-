import { router } from 'expo-router';

import { AppText, Card, Checkbox, ChoiceGroup } from '../../src/design-system';
import { getTestingEvent } from '../../src/content';
import { OnboardingStepScreen } from '../../src/features/onboarding/OnboardingStepScreen';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';

export default function Week0TestingIntroScreen() {
  const { data, update } = useOnboarding();
  const week0 = getTestingEvent('week0');

  function handleSprintAnswer(value: 'yes' | 'no') {
    const hasSprintedRecently = value === 'yes';
    update({
      hasSprintedRecently,
      // Suggested, never silently applied — the athlete confirms below.
      deferWeek0SprintTest: !hasSprintedRecently,
    });
  }

  return (
    <OnboardingStepScreen
      step="week0-testing-intro"
      title="Week 0: your baseline"
      subtitle={week0.note}
      onNext={() => router.push('/(onboarding)/starting-maxes')}
    >
      <Card className="mb-6">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 6 }}>
          SUGGESTED SCHEDULE (FLEXIBLE)
        </AppText>
        {week0.suggestedSchedule.days.map((day, i) => (
          <AppText key={i} variant="bodySm" color="primary" style={{ marginBottom: 6 }}>
            • {day.suggestedDay ? `${day.suggestedDay}: ` : ''}
            {day.what}
          </AppText>
        ))}
      </Card>

      <ChoiceGroup
        label="Have you sprinted at or near full effort recently (within the last few years)?"
        required
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No / not since I was younger' },
        ]}
        value={data.hasSprintedRecently ? 'yes' : 'no'}
        onChange={handleSprintAnswer}
      />

      <Card className="mb-2">
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
          {week0.schedulingRules.sprintDeferral}
        </AppText>
        <Checkbox
          label="Defer the 10-yard sprint test to Week 6"
          checked={data.deferWeek0SprintTest}
          onChange={(checked) => update({ deferWeek0SprintTest: checked })}
        />
      </Card>
    </OnboardingStepScreen>
  );
}
