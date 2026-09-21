import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Checkbox,
  RatingScale,
  Screen,
  TextField,
} from '../../../src/design-system';
import { useSubmitReadiness } from '../../../src/features/readiness/useReadinessGate';
import { useEstablishedRestingHeartRate } from '../../../src/features/testing/useTesting';
import { useEnrollmentSchedule } from '../../../src/features/program/useEnrollmentSchedule';
import { buildScheduledDay } from '../../../src/features/schedule/scheduleEngine';

export default function ReadinessCheckScreen() {
  const params = useLocalSearchParams<{ date: string; slot: 'am' | 'pm' }>();
  const date = params.date!;
  const submitReadiness = useSubmitReadiness();
  const { data: establishedRhr } = useEstablishedRestingHeartRate();
  const { data: scheduleContext } = useEnrollmentSchedule();

  const [sleepHours, setSleepHours] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [baselineRestingHr, setBaselineRestingHr] = useState('');
  const [baselineTouched, setBaselineTouched] = useState(false);

  // Shown to the user rounded to 1 decimal (display convention); the value
  // actually submitted for the readiness comparison stays full-precision
  // whenever the athlete hasn't overridden the auto-filled baseline — see
  // `submittedBaseline` below and rhrWorkflow.ts's `EstablishedRhr` docs.
  const effectiveBaseline =
    !baselineTouched && establishedRhr ? String(establishedRhr.bpmDisplay) : baselineRestingHr;
  const submittedBaseline =
    !baselineTouched && establishedRhr
      ? establishedRhr.bpm
      : baselineRestingHr
        ? Number(baselineRestingHr)
        : null;
  const [calfAchillesFlag, setCalfAchillesFlag] = useState(false);
  const [hamstringGrabbyFlag, setHamstringGrabbyFlag] = useState(false);
  const [jointPainFlag, setJointPainFlag] = useState(false);
  const [jointPainLocation, setJointPainLocation] = useState('');
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const slot = params.slot === 'pm' ? 'pm' : 'am';
  const originalSlotSnapshot = scheduleContext
    ? (() => {
        const scheduledDay = buildScheduledDay(scheduleContext.scheduleInput, date);
        const slotSession = slot === 'am' ? scheduledDay.am : scheduledDay.pm;
        return {
          date,
          slot,
          sessionType: slotSession.sessionType,
          title: slotSession.title,
        };
      })()
    : null;

  const handleSubmit = async () => {
    const result = await submitReadiness.mutateAsync({
      entryDate: date,
      sleepHours: sleepHours ? Number(sleepHours) : null,
      restingHr: restingHr ? Number(restingHr) : null,
      baselineRestingHr: submittedBaseline,
      originalSlotSnapshot,
      calfAchillesFlag,
      hamstringGrabbyFlag,
      jointPainFlag,
      jointPainLocation: jointPainFlag ? jointPainLocation || null : null,
      readinessScore,
      notes: notes || null,
    });

    if (result.evaluation.requiresConfirmation) {
      router.replace({
        pathname: '/(tabs)/today/safety-adjustment',
        params: { date, slot: params.slot },
      });
    } else {
      router.back();
    }
  };

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        READINESS CHECK
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        Before you start
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        A quick check before speed, plyometric, or strength work. Answer honestly — this decides
        whether today&apos;s session is adjusted, never the other way around.
      </AppText>

      <Card className="mb-4">
        <TextField
          label="Sleep last night (hours)"
          keyboardType="decimal-pad"
          value={sleepHours}
          onChangeText={setSleepHours}
          placeholder="e.g. 7.5"
        />
        <TextField
          label="Resting heart rate this morning (bpm) — a single reading"
          keyboardType="number-pad"
          value={restingHr}
          onChangeText={setRestingHr}
          placeholder="e.g. 54"
        />
        <TextField
          label="Your established resting heart rate baseline (bpm)"
          keyboardType="number-pad"
          value={effectiveBaseline}
          onChangeText={(text) => {
            setBaselineTouched(true);
            setBaselineRestingHr(text);
          }}
          placeholder="e.g. 50"
          hint={
            establishedRhr
              ? `Auto-filled from your established 3-morning average (${establishedRhr.sourceEvent}). This is not a single reading — it only updates when you re-run the 3-morning RHR test.`
              : 'From your Week 0 baseline testing, averaged over 3 mornings. Log 3 morning readings in the Testing tab to establish this automatically.'
          }
        />
      </Card>

      <Card className="mb-4">
        <Checkbox
          label="Calf or Achilles tightness, soreness, or a twinge"
          checked={calfAchillesFlag}
          onChange={setCalfAchillesFlag}
        />
        <Checkbox
          label="Hamstring feels grabby during build-ups"
          checked={hamstringGrabbyFlag}
          onChange={setHamstringGrabbyFlag}
        />
        <Checkbox
          label="Joint pain that changes how you move"
          checked={jointPainFlag}
          onChange={setJointPainFlag}
        />
        {jointPainFlag ? (
          <TextField
            label="Where?"
            value={jointPainLocation}
            onChangeText={setJointPainLocation}
            placeholder="e.g. left knee"
          />
        ) : null}
      </Card>

      <Card className="mb-4">
        <RatingScale
          label="General readiness (1 = wrecked, 5 = great)"
          value={readinessScore}
          onChange={setReadinessScore}
        />
        <TextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything else worth flagging"
          multiline
        />
      </Card>

      <View style={{ marginTop: 8 }}>
        <Button onPress={handleSubmit} loading={submitReadiness.isPending}>
          Continue
        </Button>
      </View>
    </Screen>
  );
}
