import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  DatePickerField,
  Screen,
  TextField,
} from '../../../../src/design-system';
import { useEnrollmentSchedule } from '../../../../src/features/program/useEnrollmentSchedule';
import { RhrDuplicateMorningError } from '../../../../src/features/testing/rhrWorkflow';
import {
  useRecordRhrReading,
  useTestingSession,
} from '../../../../src/features/testing/useTesting';
import type { TestingEventKey } from '../../../../src/features/testing/testingSchedule';

export default function RhrScreen() {
  const { eventKey } = useLocalSearchParams<{ eventKey: TestingEventKey; sessionId: string }>();
  const { data, isLoading } = useTestingSession(eventKey);
  const { data: scheduleContext } = useEnrollmentSchedule();
  const recordReading = useRecordRhrReading();

  const [morningDate, setMorningDate] = useState(scheduleContext?.todayIso ?? '');
  const [bpm, setBpm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    existingBpm: number;
    morningDate: string;
    newBpm: number;
  } | null>(null);

  if (isLoading || !data || !scheduleContext) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const draftDate = morningDate || scheduleContext.todayIso;

  async function submit(allowCorrection: boolean) {
    const numericBpm = Number(bpm);
    if (!Number.isFinite(numericBpm) || numericBpm < 25 || numericBpm > 220) {
      setError('Enter a resting heart rate between 25 and 220 bpm.');
      return;
    }
    setError(null);
    try {
      await recordReading.mutateAsync({
        testingSessionId: data!.sessionId,
        morningDate: draftDate,
        bpm: numericBpm,
        allowCorrection,
      });
      setBpm('');
      setDuplicateConfirm(null);
    } catch (err) {
      if (err instanceof RhrDuplicateMorningError) {
        setDuplicateConfirm({
          existingBpm: err.existingBpm,
          morningDate: err.morningDate,
          newBpm: numericBpm,
        });
        return;
      }
      throw err;
    }
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        MARKER #1 · RESTING HEART RATE
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 6 }}>
        Three-morning baseline
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 20 }}>
        Take your pulse before rising, on three separate mornings. Your established baseline is the
        average of all three — a single morning&apos;s reading is not the baseline by itself.
      </AppText>

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          PROGRESS: {data.rhrProgress.completed} OF {data.rhrProgress.required}
        </AppText>
        {[0, 1, 2].map((i) => {
          const reading = data.rhrReadings[i];
          return (
            <View
              key={i}
              className="flex-row items-center justify-between py-2"
              style={{ minHeight: 44 }}
            >
              <AppText variant="body" color={reading ? 'primary' : 'muted'}>
                Morning {i + 1}
                {reading ? ` · ${reading.morningDate}` : ' — not yet logged'}
              </AppText>
              {reading ? <Badge label={`${reading.bpm} bpm`} tone="success" /> : null}
            </View>
          );
        })}
        {data.establishedRhr ? (
          <AppText variant="body" color="accent" style={{ marginTop: 10 }}>
            Established baseline: {data.establishedRhr.bpmDisplay} bpm
          </AppText>
        ) : null}
      </Card>

      <Card className="mb-4">
        <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
          LOG A MORNING READING
        </AppText>
        <DatePickerField
          label="Morning"
          value={draftDate}
          onChange={setMorningDate}
          maximumDate={new Date()}
        />
        <TextField
          label="Resting heart rate (bpm)"
          keyboardType="number-pad"
          value={bpm}
          onChangeText={setBpm}
          placeholder="e.g. 58"
          error={error ?? undefined}
        />
        <Button onPress={() => submit(false)} loading={recordReading.isPending}>
          Save this morning
        </Button>
      </Card>

      {duplicateConfirm ? (
        <Card className="mb-4" emphasized>
          <AppText variant="body" color="primary" style={{ marginBottom: 8 }}>
            Already logged
          </AppText>
          <AppText variant="bodySm" color="secondary" style={{ marginBottom: 16 }}>
            You already recorded {duplicateConfirm.existingBpm} bpm for{' '}
            {duplicateConfirm.morningDate}. Replace it with {duplicateConfirm.newBpm} bpm?
          </AppText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" onPress={() => setDuplicateConfirm(null)}>
                Cancel
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button onPress={() => submit(true)} loading={recordReading.isPending}>
                Replace
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      <AppText variant="bodySm" color="muted">
        Logging the same morning again updates that reading in place rather than adding a duplicate
        — you&apos;ll be asked to confirm before it&apos;s replaced.
      </AppText>
    </Screen>
  );
}
