import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Card, Divider, Screen } from '../../../src/design-system';
import type { BadgeTone } from '../../../src/design-system';
import { tierLabel } from '../../../src/features/testing/markerFormats';
import { useTestingComparison } from '../../../src/features/testing/useTesting';
import type { MarkerComparison } from '../../../src/features/testing/testingResultsAggregation';

function directionTone(direction: 'improved' | 'declined' | 'unchanged' | undefined): BadgeTone {
  if (direction === 'improved') return 'success';
  if (direction === 'declined') return 'danger';
  return 'neutral';
}

function directionLabel(direction: 'improved' | 'declined' | 'unchanged' | undefined): string {
  if (direction === 'improved') return 'Improved';
  if (direction === 'declined') return 'Declined';
  if (direction === 'unchanged') return 'Unchanged';
  return 'Not comparable';
}

function ComparisonRow({ comparison }: { comparison: MarkerComparison }) {
  const { marker, week0, week6, week12, changeToWeek12, changeToWeek6, baselineEvent } = comparison;
  const hasAnything =
    week0?.hasResult || week6?.hasResult || week12?.hasResult || week0?.isDeferred;
  if (!hasAnything) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/(tabs)/testing/history/[markerNumber]',
          params: { markerNumber: String(marker.num) },
        })
      }
    >
      <Card className="mb-3">
        <AppText variant="body" color="primary" style={{ marginBottom: 6 }}>
          #{marker.num} {marker.name}
        </AppText>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-2">
          <AppText variant="bodySm" color="secondary">
            Week 0: {week0?.isDeferred ? 'Deferred' : (week0?.displayValue ?? '—')}
          </AppText>
          <AppText variant="bodySm" color="secondary">
            Week 6: {week6?.displayValue ?? '—'}
          </AppText>
          <AppText variant="bodySm" color="secondary">
            Week 12: {week12?.displayValue ?? '—'}
          </AppText>
        </View>
        {baselineEvent === 'week6' ? (
          <AppText variant="caption" color="muted" style={{ marginBottom: 6 }}>
            Baseline established at Week 6 (sprint was deferred at Week 0)
          </AppText>
        ) : null}
        <View className="flex-row items-center gap-2 flex-wrap">
          {changeToWeek12 ? (
            <Badge
              label={`${directionLabel(changeToWeek12.direction)} · ${changeToWeek12.absoluteChange > 0 ? '+' : ''}${changeToWeek12.absoluteChange.toFixed(1)}${changeToWeek12.percentChange != null ? ` (${changeToWeek12.percentChange > 0 ? '+' : ''}${changeToWeek12.percentChange.toFixed(0)}%)` : ''}`}
              tone={directionTone(changeToWeek12.direction)}
            />
          ) : week12?.hasResult || week0?.hasResult ? (
            <Badge label="Not comparable" tone="neutral" />
          ) : null}
          {week12?.classification ? (
            <Badge label={tierLabel(week12.classification)} tone="gold" />
          ) : null}
        </View>
        {changeToWeek6 ? (
          <AppText variant="caption" color="muted" style={{ marginTop: 6 }}>
            Week 0 → Week 6: {changeToWeek6.absoluteChange > 0 ? '+' : ''}
            {changeToWeek6.absoluteChange.toFixed(1)} ({directionLabel(changeToWeek6.direction)})
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

export default function TestingCompareScreen() {
  const { data, isLoading } = useTestingComparison();

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const longevity = data.filter((c) => c.markerNumber <= 10);
  const athletic = data.filter((c) => c.markerNumber >= 11);
  const anyResults = data.some(
    (c) => c.week0?.hasResult || c.week6?.hasResult || c.week12?.hasResult || c.week0?.isDeferred,
  );

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 6 }}>
        Week 0 · 6 · 12
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        A full 15-marker comparison runs Week 0 to Week 12. Week 6 only ever supplies six markers
        (plus the sprint if it was deferred) — shown here for reference, never as a full retest.
      </AppText>

      {!anyResults ? (
        <Card>
          <AppText variant="body" color="secondary">
            No testing results logged yet. Complete Week 0 baseline testing to see comparisons here.
          </AppText>
        </Card>
      ) : (
        <>
          <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
            LONGEVITY TEN
          </AppText>
          {longevity.map((c) => (
            <ComparisonRow key={c.markerNumber} comparison={c} />
          ))}
          <Divider className="my-4" />
          <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
            ATHLETIC FIVE
          </AppText>
          {athletic.map((c) => (
            <ComparisonRow key={c.markerNumber} comparison={c} />
          ))}
        </>
      )}
    </Screen>
  );
}
