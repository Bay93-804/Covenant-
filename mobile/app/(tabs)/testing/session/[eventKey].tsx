import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../../src/design-system';
import type { BadgeTone } from '../../../../src/design-system';
import {
  useFinalizeTestingSession,
  useStartTestingSession,
  useTestingSession,
} from '../../../../src/features/testing/useTesting';
import type { MarkerEntryState } from '../../../../src/features/testing/testingResultsAggregation';
import { tierLabel } from '../../../../src/features/testing/markerFormats';
import type { TestingEventKey } from '../../../../src/features/testing/testingSchedule';

function markerStateTone(state: MarkerEntryState): BadgeTone {
  switch (state) {
    case 'complete':
      return 'success';
    case 'deferred':
      return 'gold';
    case 'in_progress':
      return 'gold';
    default:
      return 'neutral';
  }
}

function markerStateLabel(state: MarkerEntryState): string {
  switch (state) {
    case 'complete':
      return 'Logged';
    case 'deferred':
      return 'Deferred';
    case 'in_progress':
      return 'In progress';
    default:
      return 'Not started';
  }
}

export default function TestingSessionScreen() {
  const { eventKey } = useLocalSearchParams<{ eventKey: TestingEventKey }>();
  const { data, isLoading } = useTestingSession(eventKey);
  const startSession = useStartTestingSession();
  const finalizeSession = useFinalizeTestingSession();
  const [confirming, setConfirming] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  async function handleOpenMarker(markerNumber: number) {
    if (!data!.startedAt) {
      await startSession.mutateAsync(data!.sessionId);
    }
    if (markerNumber === 1) {
      router.push({
        pathname: '/(tabs)/testing/rhr/[eventKey]',
        params: { eventKey: data!.eventKey, sessionId: data!.sessionId },
      });
      return;
    }
    router.push({
      pathname: '/(tabs)/testing/marker/[markerNumber]',
      params: {
        markerNumber: String(markerNumber),
        eventKey: data!.eventKey,
        sessionId: data!.sessionId,
      },
    });
  }

  async function confirmFinalize() {
    setConfirming(true);
    try {
      await finalizeSession.mutateAsync(data!.sessionId);
      setShowFinalizeConfirm(false);
    } finally {
      setConfirming(false);
    }
  }

  const longevityTenMarkers = data.markers.filter((m) => m <= 10);
  const athleticFiveMarkers = data.markers.filter((m) => m >= 11);

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        {data.window.windowStart} – {data.window.windowEnd}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        {data.window.label}
      </AppText>
      {data.completedAt ? (
        <Badge label="Completed" tone="success" />
      ) : data.startedAt ? (
        <Badge label="In progress" tone="gold" />
      ) : (
        <Badge label="Not started" tone="neutral" />
      )}

      {data.eventKey === 'week0' ? (
        <Card className="mt-4 mb-4">
          <AppText variant="caption" color="secondary" style={{ marginBottom: 8 }}>
            RESTING HEART RATE
          </AppText>
          <AppText variant="body" color="primary" style={{ marginBottom: 6 }}>
            {data.rhrProgress.completed} of {data.rhrProgress.required} mornings logged
            {data.establishedRhr
              ? ` · established baseline ${data.establishedRhr.bpmDisplay} bpm`
              : ''}
          </AppText>
          <Button
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/testing/rhr/[eventKey]',
                params: { eventKey: data.eventKey, sessionId: data.sessionId },
              })
            }
          >
            {data.rhrProgress.isComplete ? 'Review mornings' : 'Log a morning reading'}
          </Button>
        </Card>
      ) : null}

      {data.eventKey === 'week0' && data.sprintDeferred ? (
        <Card className="mb-4">
          <Badge label="Sprint deferred" tone="gold" />
          <AppText variant="bodySm" color="secondary" style={{ marginTop: 8 }}>
            The 10-yard sprint was deferred to Week 6. Reason: {data.sprintDeferralReason}
          </AppText>
        </Card>
      ) : null}

      <Divider className="my-4" />
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        LONGEVITY TEN
      </AppText>
      {longevityTenMarkers.map((num) => {
        const summary = data.summaries.get(num)!;
        const state = data.entryStates.get(num)!;
        return (
          <Pressable key={num} accessibilityRole="button" onPress={() => handleOpenMarker(num)}>
            <Card className="mb-3">
              <View className="flex-row items-center justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <AppText variant="body" color="primary">
                    #{num} {summary.marker.name}
                  </AppText>
                  {summary.displayValue ? (
                    <AppText variant="bodySm" color="secondary" style={{ marginTop: 2 }}>
                      {summary.displayValue}
                      {summary.classification ? ` · ${tierLabel(summary.classification)}` : ''}
                    </AppText>
                  ) : null}
                </View>
                <Badge label={markerStateLabel(state)} tone={markerStateTone(state)} />
              </View>
            </Card>
          </Pressable>
        );
      })}

      <AppText variant="caption" color="secondary" style={{ marginTop: 12, marginBottom: 10 }}>
        ATHLETIC FIVE
      </AppText>
      {athleticFiveMarkers.map((num) => {
        const summary = data.summaries.get(num)!;
        const state = data.entryStates.get(num)!;
        return (
          <Pressable key={num} accessibilityRole="button" onPress={() => handleOpenMarker(num)}>
            <Card className="mb-3">
              <View className="flex-row items-center justify-between">
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <AppText variant="body" color="primary">
                    #{num} {summary.marker.name}
                  </AppText>
                  {summary.displayValue ? (
                    <AppText variant="bodySm" color="secondary" style={{ marginTop: 2 }}>
                      {summary.displayValue}
                      {summary.classification ? ` · ${tierLabel(summary.classification)}` : ''}
                    </AppText>
                  ) : null}
                </View>
                <Badge label={markerStateLabel(state)} tone={markerStateTone(state)} />
              </View>
            </Card>
          </Pressable>
        );
      })}

      <View style={{ marginTop: 12 }}>
        {data.completedAt ? (
          <AppText variant="bodySm" color="muted" center>
            This session was finalized on {data.completedAt.slice(0, 10)}.
          </AppText>
        ) : showFinalizeConfirm ? (
          <Card emphasized>
            <AppText variant="body" color="primary" style={{ marginBottom: 6 }}>
              Finalize this testing session?
            </AppText>
            <AppText variant="bodySm" color="secondary" style={{ marginBottom: 16 }}>
              This locks in your results for {data.window.label}. You can still view them afterward,
              but this marks the session complete.
            </AppText>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" onPress={() => setShowFinalizeConfirm(false)}>
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button onPress={confirmFinalize} loading={confirming}>
                  Finalize
                </Button>
              </View>
            </View>
          </Card>
        ) : (
          <Button onPress={() => setShowFinalizeConfirm(true)} disabled={!data.isFullyComplete}>
            {data.isFullyComplete ? 'Finalize testing session' : 'Complete all markers to finalize'}
          </Button>
        )}
      </View>
    </Screen>
  );
}
