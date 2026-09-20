import { Alert, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { getTodaySessionSummary } from '../../../src/content';
import { computeTodayContext } from '../../../src/features/today/computeTodayContext';
import { useEnrollmentStatus } from '../../../src/lib/onboarding/useEnrollmentStatus';

function SessionCard({
  slotLabel,
  label,
  minutesLow,
  minutesHigh,
  isRestDay,
}: {
  slotLabel: string;
  label: string;
  minutesLow: number | null;
  minutesHigh: number | null;
  isRestDay: boolean;
}) {
  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Badge label={slotLabel} tone={isRestDay ? 'neutral' : 'gold'} />
        {!isRestDay && minutesLow ? (
          <AppText variant="caption" color="muted">
            {minutesLow}–{minutesHigh} MIN
          </AppText>
        ) : null}
      </View>
      <AppText variant="h3" color="primary" style={{ marginBottom: isRestDay ? 0 : 16 }}>
        {label}
      </AppText>
      {!isRestDay ? (
        <Button
          variant="secondary"
          onPress={() =>
            Alert.alert(
              'Coming soon',
              'The guided workout player and set logging arrive in a future update. This program plan is real — the interactive session player is next.',
            )
          }
        >
          Start Session
        </Button>
      ) : null}
    </Card>
  );
}

export default function TodayScreen() {
  const { data: enrollment } = useEnrollmentStatus();

  if (!enrollment?.startDate) {
    return (
      <Screen>
        <AppText variant="h2" color="primary" style={{ marginTop: 24 }}>
          Today
        </AppText>
      </Screen>
    );
  }

  const context = computeTodayContext(enrollment.startDate);

  if (context.isBeforeProgramStart) {
    return (
      <Screen scroll>
        <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
          WEEK 0 · BASELINE
        </AppText>
        <AppText variant="h1" color="primary" style={{ marginBottom: 12 }}>
          Testing week
        </AppText>
        <AppText variant="body" color="secondary" style={{ marginBottom: 24 }}>
          Your program starts {enrollment.startDate}. Complete your Week 0 baseline testing before
          then — head to the Testing tab to get started.
        </AppText>
      </Screen>
    );
  }

  if (context.isProgramComplete) {
    return (
      <Screen>
        <AppText variant="h1" color="primary" style={{ marginTop: 24 }} center>
          12 weeks, done.
        </AppText>
        <AppText variant="body" color="secondary" center style={{ marginTop: 12 }}>
          Head to Testing for your Week 12 comparison, and Profile to plan what&apos;s next.
        </AppText>
      </Screen>
    );
  }

  const summary = getTodaySessionSummary(context.weekNumber, context.dayOfWeek);
  const blockName = summary.weekContext.block?.name ?? '';

  return (
    <Screen scroll>
      <View className="mt-4 mb-6">
        <AppText variant="overline" color="accent">
          WEEK {context.weekNumber}
          {blockName ? ` · ${blockName}` : ''}
        </AppText>
        <View className="flex-row items-center gap-2 mt-1">
          <AppText variant="h1" color="primary">
            {summary.dayLabel}
          </AppText>
          {summary.weekContext.isDeload ? <Badge label="Deload" tone="neutral" /> : null}
          {summary.weekContext.isRetest ? <Badge label="Retest" tone="gold" /> : null}
          {summary.weekContext.isTaperAndTest ? <Badge label="Test Week" tone="gold" /> : null}
        </View>
      </View>

      <SessionCard
        slotLabel="AM"
        label={summary.am.label}
        minutesLow={summary.am.minutesLow}
        minutesHigh={summary.am.minutesHigh}
        isRestDay={summary.am.isRestDay}
      />
      <SessionCard
        slotLabel="PM"
        label={summary.pm.label}
        minutesLow={summary.pm.minutesLow}
        minutesHigh={summary.pm.minutesHigh}
        isRestDay={summary.pm.isRestDay}
      />

      {summary.am.isRestDay && summary.pm.isRestDay ? (
        <>
          <Divider className="my-4" />
          <AppText variant="body" color="secondary">
            Rest day. An easy 20–30 minute walk or the standalone mobility flow is optional — not
            scheduled or tracked like a training day.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}
