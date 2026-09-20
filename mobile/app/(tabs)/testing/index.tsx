import { Alert, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Screen } from '../../../src/design-system';
import { getTestingEvent } from '../../../src/content';

const events = [
  { key: 'week0' as const, label: 'Week 0', sub: 'Baseline — all 15 markers' },
  { key: 'week6' as const, label: 'Week 6', sub: 'Partial retest — 6 markers' },
  { key: 'week12' as const, label: 'Week 12', sub: 'Final test — all 15 markers' },
];

export default function TestingScreen() {
  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 4 }}>
        Testing
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        The Longevity Ten + Athletic Five. No true 1RM testing — ever.
      </AppText>

      {events.map(({ key, label, sub }) => {
        const event = getTestingEvent(key);
        return (
          <Pressable
            key={key}
            onPress={() =>
              Alert.alert('Coming soon', 'Guided marker entry forms arrive in a future update.')
            }
          >
            <Card className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <AppText variant="h3" color="primary">
                  {label}
                </AppText>
                <Badge label={`${event.markers.length} markers`} tone="gold" />
              </View>
              <AppText variant="body" color="secondary">
                {sub}
              </AppText>
            </Card>
          </Pressable>
        );
      })}

      <AppText variant="caption" color="muted" style={{ marginTop: 8 }}>
        Week 6 is intentionally a partial retest — resting heart rate, single-leg balance,
        sit-to-rise, side plank, broad jump, and the deceleration deficit — never presented as a
        full 15-marker retest.
      </AppText>
    </Screen>
  );
}
