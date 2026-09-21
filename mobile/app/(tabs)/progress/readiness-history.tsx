import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Card, Divider, Screen } from '../../../src/design-system';
import { useReadinessAndAdjustments } from '../../../src/features/progress/useProgress';

export default function ReadinessHistoryScreen() {
  const { data, isLoading } = useReadinessAndAdjustments();

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppText variant="h1" color="primary" style={{ marginTop: 16, marginBottom: 6 }}>
        Readiness history
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        This is training-logistics data you entered yourself — never a medical diagnosis or
        treatment record.
      </AppText>

      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        SAFETY ADJUSTMENTS ({data.safetyAdjustments.length})
      </AppText>
      {data.safetyAdjustments.length === 0 ? (
        <Card className="mb-4">
          <AppText variant="bodySm" color="secondary">
            No safety adjustments triggered yet.
          </AppText>
        </Card>
      ) : (
        data.safetyAdjustments.map((a) => (
          <Card key={a.id} className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Badge label={a.trigger_code.replace(/_/g, ' ')} tone="danger" />
              <Badge
                label={a.user_confirmed ? 'Confirmed' : 'Not yet confirmed'}
                tone={a.user_confirmed ? 'success' : 'neutral'}
              />
            </View>
            <AppText variant="bodySm" color="primary" style={{ marginBottom: 4 }}>
              {a.reason}
            </AppText>
            <AppText variant="bodySm" color="secondary" style={{ marginBottom: 4 }}>
              Adjustment: {a.recommended_adjustment}
            </AppText>
            <AppText variant="caption" color="muted">
              Triggered {a.created_at.slice(0, 10)}
              {a.confirmed_at ? ` · confirmed ${a.confirmed_at.slice(0, 10)}` : ''}
            </AppText>
          </Card>
        ))
      )}

      <Divider className="my-4" />
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        PICKUP SPORT ({data.sportSessions.length})
      </AppText>
      {data.sportSessions.length === 0 ? (
        <Card className="mb-4">
          <AppText variant="bodySm" color="secondary">
            No pickup-sport sessions logged yet.
          </AppText>
        </Card>
      ) : (
        data.sportSessions.map((s) => (
          <Card key={s.id} className="mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <AppText variant="body" color="primary">
                {s.sport}
              </AppText>
              <AppText variant="caption" color="muted">
                {s.played_on}
              </AppText>
            </View>
            {s.applied_adjustment_note ? (
              <AppText variant="bodySm" color="secondary">
                {s.applied_adjustment_note}
              </AppText>
            ) : null}
            <View className="flex-row items-center justify-between mt-2">
              <Badge
                label={s.user_confirmed ? 'Confirmed' : 'Pending confirmation'}
                tone={s.user_confirmed ? 'success' : 'neutral'}
              />
              {s.confirmed_at ? (
                <AppText variant="caption" color="muted">
                  {s.confirmed_at.slice(0, 10)}
                </AppText>
              ) : null}
            </View>
          </Card>
        ))
      )}

      <Divider className="my-4" />
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        READINESS CHECK-INS ({data.readinessEntries.length})
      </AppText>
      {data.readinessEntries.map((r) => (
        <View key={r.id}>
          <View className="flex-row items-center justify-between py-2" style={{ minHeight: 40 }}>
            <AppText variant="bodySm" color="primary">
              {r.entry_date}
            </AppText>
            <AppText variant="bodySm" color="secondary">
              {r.sleep_hours != null ? `${r.sleep_hours}h sleep · ` : ''}
              {r.resting_hr != null ? `${r.resting_hr} bpm` : ''}
              {r.calf_achilles_flag || r.hamstring_grabby_flag || r.joint_pain_flag
                ? ' · flagged'
                : ''}
            </AppText>
          </View>
          <Divider />
        </View>
      ))}
    </Screen>
  );
}
