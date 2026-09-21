import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Divider, Screen } from '../../../src/design-system';
import type { BadgeTone } from '../../../src/design-system';
import { getTestingEvent } from '../../../src/content';
import { useTestingHub, type TestingEventCardData } from '../../../src/features/testing/useTesting';
import type { TestingWindowState } from '../../../src/features/testing/testingSchedule';
import { testingWindowStateLabel } from '../../../src/features/testing/testingSchedule';

function stateTone(state: TestingWindowState): BadgeTone {
  switch (state) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'gold';
    case 'missed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function actionLabel(state: TestingWindowState): string {
  switch (state) {
    case 'completed':
      return 'Review results';
    case 'in_progress':
      return 'Resume testing';
    case 'available':
      return 'Begin testing';
    case 'missed':
      return 'Log late — never blocked';
    default:
      return 'Not yet available';
  }
}

function EventCard({ card }: { card: TestingEventCardData }) {
  const disabled = card.state === 'upcoming';
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${card.label}, ${testingWindowStateLabel(card.state)}`}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/testing/session/[eventKey]',
          params: { eventKey: card.eventKey },
        })
      }
    >
      <Card
        className="mb-4"
        emphasized={card.state === 'in_progress' || card.state === 'available'}
      >
        <View className="flex-row items-center justify-between mb-2">
          <AppText variant="h3" color="primary">
            {card.label}
          </AppText>
          <Badge label={testingWindowStateLabel(card.state)} tone={stateTone(card.state)} />
        </View>
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 10 }}>
          {card.completedMarkers}
          {card.deferredMarkers > 0
            ? ` completed, ${card.deferredMarkers} deferred`
            : ' completed'}{' '}
          of {card.totalMarkers} markers
        </AppText>
        <AppText variant="bodySm" color={disabled ? 'muted' : 'accent'}>
          {disabled ? `Opens ${card.window.windowStart}` : actionLabel(card.state)}
        </AppText>
      </Card>
    </Pressable>
  );
}

export default function TestingScreen() {
  const { data: cards, isLoading } = useTestingHub();
  const week0 = getTestingEvent('week0');

  if (isLoading || !cards) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const current = cards.find((c) => c.state === 'in_progress' || c.state === 'available') ?? null;

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 4 }}>
        Testing
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        The Longevity Ten + Athletic Five. No true 1RM testing — ever.
      </AppText>

      {current ? (
        <Card className="mb-4" emphasized>
          <Badge label="Current phase" tone="gold" />
          <AppText variant="h3" color="primary" style={{ marginTop: 8, marginBottom: 6 }}>
            {current.label}
          </AppText>
          <AppText variant="bodySm" color="secondary">
            {current.completedMarkers} of {current.totalMarkers} markers logged. Head into the
            checklist to continue.
          </AppText>
        </Card>
      ) : null}

      {cards.map((card) => (
        <EventCard key={card.eventKey} card={card} />
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/testing/compare')}
        style={{ marginTop: 4, marginBottom: 20 }}
      >
        <Card>
          <AppText variant="body" color="accent">
            View Week 0 · 6 · 12 comparison →
          </AppText>
        </Card>
      </Pressable>

      <Divider className="mb-4" />

      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        SAFETY
      </AppText>
      <AppText variant="bodySm" color="muted" style={{ marginBottom: 6 }}>
        {week0.note}
      </AppText>
      <AppText variant="bodySm" color="muted">
        Week 6 is intentionally a partial retest — resting heart rate, single-leg balance,
        sit-to-rise, side plank, broad jump, and the deceleration deficit — never presented as a
        full 15-marker retest.
      </AppText>
    </Screen>
  );
}
