import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { useConfirmSafetyAdjustment } from '../../../src/features/readiness/useReadinessGate';
import {
  getReadinessEntry,
  listSafetyAdjustments,
} from '../../../src/features/workout/workoutRepository';
import { useQuery } from '@tanstack/react-query';

/**
 * Blocks continuation until the athlete explicitly confirms each triggered
 * safety rule — never auto-applied. Shows the triggered reason and the
 * recommended change for every unconfirmed adjustment tied to today.
 */
export default function SafetyAdjustmentScreen() {
  const params = useLocalSearchParams<{ date: string; slot: string }>();
  const { user } = useAuth();
  const confirmAdjustment = useConfirmSafetyAdjustment();

  const { data: adjustments, isLoading } = useQuery({
    queryKey: ['safety-adjustments-for-date', user?.id, params.date],
    queryFn: async () => {
      // Correlate by the readiness entry for this date, not by comparing
      // an adjustment's created_at (a real timestamp) to the target date
      // string — those can legitimately differ (e.g. a late-night entry,
      // or here where the readiness date isn't literally "today").
      const readinessEntry = await getReadinessEntry(user!.id, params.date!);
      const all = await listSafetyAdjustments(user!.id);
      return all
        .filter((a) => a.readiness_entry_id != null && a.readiness_entry_id === readinessEntry?.id)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    },
    enabled: Boolean(user && params.date),
  });

  const unconfirmed = (adjustments ?? []).filter((a) => !a.user_confirmed);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const handleConfirmAll = async () => {
    for (const adjustment of unconfirmed) {
      await confirmAdjustment.mutateAsync(adjustment.id);
    }
    router.back();
  };

  return (
    <Screen scroll>
      <AppText variant="overline" color="danger" style={{ marginTop: 16 }}>
        SAFETY ADJUSTMENT
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        Today&apos;s plan is adjusted
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        This is educational safety guidance, not a medical diagnosis. Review each rule below —
        nothing changes until you confirm.
      </AppText>

      {(adjustments ?? []).map((adjustment) => (
        <Card key={adjustment.id} className="mb-4" emphasized>
          <Badge label={adjustment.trigger_code.replace(/_/g, ' ')} tone="danger" />
          <AppText variant="h3" color="primary" style={{ marginTop: 10, marginBottom: 6 }}>
            {adjustment.reason}
          </AppText>
          <Divider className="my-3" />
          <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
            RECOMMENDED CHANGE
          </AppText>
          <AppText variant="body" color="primary">
            {adjustment.recommended_adjustment}
          </AppText>
          {adjustment.user_confirmed ? (
            <View style={{ marginTop: 10 }}>
              <Badge label="Confirmed" tone="success" />
            </View>
          ) : null}
        </Card>
      ))}

      {unconfirmed.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Button onPress={handleConfirmAll} loading={confirmAdjustment.isPending}>
            Confirm adjustment{unconfirmed.length > 1 ? 's' : ''} and continue
          </Button>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Button onPress={() => router.back()}>Continue</Button>
        </View>
      )}
    </Screen>
  );
}
