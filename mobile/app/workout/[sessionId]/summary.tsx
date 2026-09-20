import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText, Badge, Button, Card, Screen, TextField } from '../../../src/design-system';
import { formatMs } from '../../../src/lib/timers/timerEngine';
import {
  useAddJournalEntry,
  useWorkoutPlayerData,
} from '../../../src/features/workout/useWorkoutPlayer';

const REFLECTION_PROMPTS: { key: string; question: string }[] = [
  { key: 'felt_strong', question: 'What felt strong?' },
  { key: 'needs_attention', question: 'What needs attention?' },
  { key: 'trained_with_quality', question: 'Did I train with quality?' },
  { key: 'carry_forward', question: 'What will I carry into the next session?' },
];

export default function WorkoutSummaryScreen() {
  const { sessionId, mode } = useLocalSearchParams<{ sessionId: string; mode?: string }>();
  const { data, isLoading } = useWorkoutPlayerData(sessionId!);
  const addJournal = useAddJournalEntry(sessionId!);
  const isReview = mode === 'review';

  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const { session, plan, completedSets } = data;
  const painFlags = completedSets.filter((s) => s.pain_flag);
  const volume = completedSets.reduce(
    (sum, s) => sum + (s.weight && s.reps ? s.weight * s.reps : 0),
    0,
  );

  async function handleSaveReflections() {
    for (const prompt of REFLECTION_PROMPTS) {
      const content = reflections[prompt.key];
      if (!content) continue;
      await addJournal.mutateAsync({ level: 'workout', promptKey: prompt.key, content });
    }
    setSaved(true);
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        {isReview ? 'SESSION REVIEW' : 'WORKOUT COMPLETE'}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        {plan.title}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        Week {plan.weekNumber} · {session.scheduled_date}
      </AppText>

      <Card className="mb-4">
        <View className="flex-row justify-between mb-3">
          <AppText variant="caption" color="secondary">
            DURATION
          </AppText>
          <AppText variant="body" color="primary">
            {session.duration_actual_seconds
              ? formatMs(session.duration_actual_seconds * 1000)
              : '—'}
          </AppText>
        </View>
        <View className="flex-row justify-between mb-3">
          <AppText variant="caption" color="secondary">
            SETS LOGGED
          </AppText>
          <AppText variant="body" color="primary">
            {completedSets.length}
          </AppText>
        </View>
        {volume > 0 ? (
          <View className="flex-row justify-between mb-3">
            <AppText variant="caption" color="secondary">
              VOLUME
            </AppText>
            <AppText variant="body" color="primary">
              {Math.round(volume).toLocaleString()} lb
            </AppText>
          </View>
        ) : null}
        {plan.adjustmentSummary.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <AppText variant="caption" color="secondary" style={{ marginBottom: 6 }}>
              ADJUSTMENTS APPLIED
            </AppText>
            {plan.adjustmentSummary.map((line, i) => (
              <AppText key={i} variant="bodySm" color="primary">
                • {line}
              </AppText>
            ))}
          </View>
        ) : null}
      </Card>

      {painFlags.length > 0 ? (
        <Card className="mb-4">
          <Badge label="Pain flagged" tone="danger" />
          <AppText variant="bodySm" color="secondary" style={{ marginTop: 8 }}>
            {painFlags.length} set{painFlags.length > 1 ? 's' : ''} flagged pain this session.
            Review with a qualified professional if it changes how you move.
          </AppText>
        </Card>
      ) : null}

      {!isReview ? (
        <Card className="mb-4">
          <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
            REFLECTION (OPTIONAL)
          </AppText>
          {REFLECTION_PROMPTS.map((prompt) => (
            <TextField
              key={prompt.key}
              label={prompt.question}
              value={reflections[prompt.key] ?? ''}
              onChangeText={(v) => setReflections((r) => ({ ...r, [prompt.key]: v }))}
              multiline
            />
          ))}
          <Button
            variant="secondary"
            onPress={handleSaveReflections}
            loading={addJournal.isPending}
          >
            {saved ? 'Saved' : 'Save reflection'}
          </Button>
        </Card>
      ) : null}

      <Button onPress={() => router.replace('/(tabs)/today')}>Back to Today</Button>
    </Screen>
  );
}
