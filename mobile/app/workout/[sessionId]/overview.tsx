import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import {
  useStartSession,
  useWorkoutPlayerData,
} from '../../../src/features/workout/useWorkoutPlayer';

export default function WorkoutOverviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data, isLoading } = useWorkoutPlayerData(sessionId!);
  const startSession = useStartSession(sessionId!);

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const { session, plan } = data;

  const handleStart = async () => {
    await startSession.mutateAsync();
    router.replace({ pathname: '/workout/[sessionId]/player', params: { sessionId: session.id } });
  };

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        {plan.slot.toUpperCase()} SESSION · WEEK {plan.weekNumber}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        {plan.title}
      </AppText>
      {plan.estMinutesLow ? (
        <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
          Estimated {plan.estMinutesLow}
          {plan.estMinutesHigh && plan.estMinutesHigh !== plan.estMinutesLow
            ? `–${plan.estMinutesHigh}`
            : ''}{' '}
          minutes
        </AppText>
      ) : null}

      {plan.adjustmentSummary.length > 0 ? (
        <Card className="mb-4" emphasized>
          <Badge label="Adjusted today" tone="danger" />
          {plan.adjustmentSummary.map((line, i) => (
            <AppText key={i} variant="bodySm" color="primary" style={{ marginTop: 8 }}>
              • {line}
            </AppText>
          ))}
        </Card>
      ) : null}

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          {plan.supportsPerSetLogging ? `${plan.exercises.length} EXERCISES` : "TODAY'S FLOW"}
        </AppText>
        {plan.supportsPerSetLogging
          ? plan.exercises.map((exercise) => (
              <View key={exercise.key} className="mb-3">
                <AppText variant="body" color="primary">
                  {exercise.order}. {exercise.name}
                </AppText>
                <AppText variant="bodySm" color="muted">
                  {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                  {exercise.eachSide ? ' (each side)' : ''}
                </AppText>
              </View>
            ))
          : plan.segments.map((segment) => (
              <View key={segment.key} className="mb-3">
                <AppText variant="body" color="primary">
                  {segment.label}
                </AppText>
                <AppText variant="bodySm" color="muted">
                  {segment.blocked ? segment.blockedReason : segment.detail}
                </AppText>
              </View>
            ))}
      </Card>

      <Divider className="mb-4" />

      <Button onPress={handleStart} loading={startSession.isPending}>
        {session.status === 'in_progress' ? 'Resume session' : 'Start session'}
      </Button>
    </Screen>
  );
}
