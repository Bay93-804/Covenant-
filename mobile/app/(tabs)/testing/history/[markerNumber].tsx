import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Card, Divider, Screen } from '../../../../src/design-system';
import { getTestingMarker } from '../../../../src/content';
import { useMarkerHistory } from '../../../../src/features/testing/useTesting';
import { isSprintDeferralRow } from '../../../../src/features/testing/sprintDeferral';

export default function MarkerHistoryScreen() {
  const { markerNumber } = useLocalSearchParams<{ markerNumber: string }>();
  const num = Number(markerNumber);
  const { data, isLoading } = useMarkerHistory(num);
  const marker = getTestingMarker(num);

  if (isLoading || !data || !marker) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        MARKER #{num}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        {marker.name}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        {marker.protocol}
      </AppText>

      {data.length === 0 ? (
        <Card>
          <AppText variant="bodySm" color="secondary">
            No attempts recorded yet.
          </AppText>
        </Card>
      ) : (
        data.map((r) => (
          <View key={r.id}>
            <View className="flex-row items-center justify-between py-2" style={{ minHeight: 40 }}>
              <AppText variant="bodySm" color="secondary">
                {r.recorded_at.slice(0, 10)}
                {r.side ? ` · ${r.side}` : ''}
                {r.attempt_number > 0 ? ` · attempt ${r.attempt_number}` : ''}
              </AppText>
              {isSprintDeferralRow(r) ? (
                <Badge label="Deferred" tone="gold" />
              ) : (
                <AppText variant="bodySm" color="primary">
                  {r.value_numeric ?? r.value_text ?? '—'}
                  {r.is_best_attempt ? ' ★' : ''}
                </AppText>
              )}
            </View>
            {r.notes ? (
              <AppText variant="caption" color="muted" style={{ marginBottom: 4 }}>
                {r.notes}
              </AppText>
            ) : null}
            <Divider />
          </View>
        ))
      )}
    </Screen>
  );
}
