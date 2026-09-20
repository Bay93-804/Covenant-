import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Screen,
  TextField,
} from '../../../src/design-system';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { useEnrollmentSchedule } from '../../../src/features/program/useEnrollmentSchedule';
import { buildScheduledDay } from '../../../src/features/schedule/scheduleEngine';
import {
  evaluatePickupSportAdjustments,
  type SportAdjustmentEvaluation,
} from '../../../src/features/pickupSport/sportAdjustmentRules';
import { createSportSession } from '../../../src/features/workout/workoutRepository';

const SPORTS = [
  'Basketball',
  'Softball',
  'Flag football',
  'Soccer',
  'Tennis',
  'Pickleball',
  'Other',
];

export default function SportAdjustmentScreen() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();

  const [sport, setSport] = useState(SPORTS[0]!);
  const [playedOn, setPlayedOn] = useState(scheduleContext?.todayIso ?? '');
  const [gamesThisWeek, setGamesThisWeek] = useState('1');
  const [returningAfterMonthsAway, setReturningAfterMonthsAway] = useState(false);
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<SportAdjustmentEvaluation | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!scheduleContext) return null;

  const scheduledDay = buildScheduledDay(
    scheduleContext.scheduleInput,
    playedOn || scheduleContext.todayIso,
  );
  const hasCompletedBlock1 = scheduledDay.weekNumber > 4;

  function handlePreview() {
    const result = evaluatePickupSportAdjustments({
      playedOn: playedOn || scheduleContext!.todayIso,
      sport,
      gamesThisWeek: Number(gamesThisWeek) || 1,
      returningAfterMonthsAway,
      hasCompletedBlock1,
    });
    setEvaluation(result);
    setConfirmed(false);
  }

  async function handleConfirm() {
    if (!evaluation) return;
    setSaving(true);
    try {
      const code = evaluation.recommendations[0]?.code ?? null;
      const choice = code ? choiceSelections[code] : null;
      await createSportSession({
        id: '',
        userId: user!.id,
        playedOn: playedOn || scheduleContext!.todayIso,
        sport,
        gamesThisWeek: Number(gamesThisWeek) || 1,
        appliedAdjustmentCode: code,
        appliedAdjustmentNote: choice
          ? `${evaluation.recommendations[0]!.description} (chose: ${choice})`
          : (evaluation.recommendations[0]?.description ?? evaluation.gateReason),
      });
      setConfirmed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        PICKUP SPORT
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        Log a game
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        We&apos;ll preview the schedule change before anything is applied — nothing changes until
        you confirm.
      </AppText>

      <Card className="mb-4">
        <TextField
          label="Sport"
          value={sport}
          onChangeText={setSport}
          placeholder="e.g. Basketball"
        />
        <TextField label="Date played (YYYY-MM-DD)" value={playedOn} onChangeText={setPlayedOn} />
        <TextField
          label="Games this week (including this one)"
          keyboardType="number-pad"
          value={gamesThisWeek}
          onChangeText={setGamesThisWeek}
        />
        <Checkbox
          label="I haven't played a competitive game in months"
          checked={returningAfterMonthsAway}
          onChange={setReturningAfterMonthsAway}
        />
      </Card>

      <Button variant="secondary" onPress={handlePreview}>
        Preview adjustment
      </Button>

      {evaluation ? (
        <Card className="mt-4 mb-4" emphasized>
          {evaluation.gateBlocked ? (
            <>
              <Badge label="Not yet" tone="danger" />
              <AppText variant="body" color="primary" style={{ marginTop: 10 }}>
                {evaluation.gateReason}
              </AppText>
            </>
          ) : (
            <>
              {evaluation.recommendations.map((rec) => (
                <View key={rec.code} style={{ marginBottom: 12 }}>
                  <AppText variant="h3" color="primary" style={{ marginBottom: 6 }}>
                    {rec.description}
                  </AppText>
                  {rec.requiresUserChoice && rec.choices ? (
                    <View className="flex-row gap-2 flex-wrap">
                      {rec.choices.map((choice) => (
                        <Pressable
                          key={choice.value}
                          onPress={() =>
                            setChoiceSelections((prev) => ({ ...prev, [rec.code]: choice.value }))
                          }
                        >
                          <Badge
                            label={choice.label}
                            tone={choiceSelections[rec.code] === choice.value ? 'gold' : 'neutral'}
                          />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
              <Divider className="my-3" />
              <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
                PREGAME WARM-UP
              </AppText>
              <AppText variant="bodySm" color="primary" style={{ marginBottom: 10 }}>
                {evaluation.pregameWarmup}
              </AppText>
              <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
                AFTER THE GAME
              </AppText>
              <AppText variant="bodySm" color="primary">
                {evaluation.postGameNote}
              </AppText>
            </>
          )}
        </Card>
      ) : null}

      {evaluation && !evaluation.gateBlocked ? (
        <Button onPress={handleConfirm} loading={saving}>
          {confirmed ? 'Confirmed' : 'Confirm adjustment'}
        </Button>
      ) : null}

      {confirmed ? (
        <View style={{ marginTop: 8 }}>
          <Button variant="ghost" onPress={() => router.back()}>
            Done
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
