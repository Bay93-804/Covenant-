import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import { AppText, Button, ProgressDots, Screen } from '../../design-system';
import { onboardingSteps, stepIndex, type OnboardingStep } from './steps';

interface OnboardingStepScreenProps extends PropsWithChildren {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  onNext: () => void | Promise<void>;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showBack?: boolean;
}

export function OnboardingStepScreen({
  step,
  title,
  subtitle,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  nextLoading = false,
  showBack = true,
  children,
}: OnboardingStepScreenProps) {
  const index = stepIndex(step);

  return (
    <Screen scroll>
      <View className="mt-4 mb-6">
        <ProgressDots total={onboardingSteps.length} current={index} />
      </View>

      <AppText variant="h1" color="primary" style={{ marginBottom: 8 }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="secondary" style={{ marginBottom: 24 }}>
          {subtitle}
        </AppText>
      ) : (
        <View style={{ marginBottom: 16 }} />
      )}

      <View className="flex-1">{children}</View>

      <View className="mt-6 gap-3">
        <Button onPress={onNext} disabled={nextDisabled} loading={nextLoading}>
          {nextLabel}
        </Button>
        {showBack && router.canGoBack() ? (
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}
