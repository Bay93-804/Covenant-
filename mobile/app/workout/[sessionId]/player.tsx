import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';

import { AppText, Badge, Button, Card, Divider, Screen } from '../../../src/design-system';
import { semanticColor } from '../../../src/design-system/tokens';
import { useAuth } from '../../../src/lib/auth/AuthContext';
import { calculateRecommendedLoad } from '../../../src/features/loadCalculator/loadCalculator';
import { LIFT_KEY_BY_STRENGTH_LETTER } from '../../../src/features/loadCalculator/liftKeyForStrengthDay';
import { listSubstitutions } from '../../../src/content';
import { parseRestLabelToMs, formatMs } from '../../../src/lib/timers/timerEngine';
import { useTimer } from '../../../src/lib/timers/useTimer';
import { playLightTap } from '../../../src/lib/timers/feedback';
import type {
  PlayerExercise,
  PlayerSegment,
  PlayerSetTarget,
} from '../../../src/features/workout/sessionPlanBuilder';
import {
  useAddJournalEntry,
  useCompleteSession,
  useLogSet,
  usePreviousPerformance,
  useStartSession,
  useWorkoutPlayerData,
} from '../../../src/features/workout/useWorkoutPlayer';
import { getLatestExerciseMax } from '../../../src/features/workout/workoutRepository';
import { useQuery } from '@tanstack/react-query';

function MiniInput({
  value,
  onChangeText,
  placeholder,
  width = 56,
  keyboardType = 'decimal-pad',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  width?: number;
  keyboardType?: 'decimal-pad' | 'number-pad' | 'default';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={semanticColor.textMuted}
      keyboardType={keyboardType}
      style={{
        width,
        minHeight: 40,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: semanticColor.borderSubtle,
        backgroundColor: semanticColor.backgroundElevated,
        color: semanticColor.textPrimary,
        paddingHorizontal: 8,
        fontSize: 15,
        textAlign: 'center',
      }}
    />
  );
}

interface SetRowState {
  weight: string;
  reps: string;
  actualRir: string;
  quality: number | null;
  pain: boolean;
  logged: boolean;
}

function setKey(exerciseKey: string, set: PlayerSetTarget): string {
  return `${exerciseKey}-${set.setNumber}-${set.side ?? 'na'}`;
}

function ExerciseCard({
  exercise,
  sessionId,
  weekNumber,
  strengthLetter,
  onSetLogged,
}: {
  exercise: PlayerExercise;
  sessionId: string;
  weekNumber: number;
  strengthLetter: string | null;
  onSetLogged: (restLabel: string | null) => void;
}) {
  const { user } = useAuth();
  const logSet = useLogSet(sessionId);
  const { data: previousSets } = usePreviousPerformance(exercise.workoutExerciseId, sessionId);
  const liftKey = strengthLetter
    ? LIFT_KEY_BY_STRENGTH_LETTER[strengthLetter as 'A' | 'B' | 'C' | 'D']
    : null;

  const { data: exerciseMax } = useQuery({
    queryKey: ['exercise-max', user?.id, liftKey],
    queryFn: () => getLatestExerciseMax(user!.id, liftKey!),
    enabled: Boolean(user && liftKey),
  });

  const [rows, setRows] = useState<Record<string, SetRowState>>(() =>
    Object.fromEntries(
      exercise.sets.map((s) => [
        setKey(exercise.key, s),
        { weight: '', reps: '', actualRir: '', quality: null, pain: false, logged: false },
      ]),
    ),
  );
  const [substitutionOpen, setSubstitutionOpen] = useState(false);

  function updateRow(key: string, patch: Partial<SetRowState>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));
  }

  async function handleLog(set: PlayerSetTarget) {
    const key = setKey(exercise.key, set);
    const row = rows[key]!;
    await logSet.mutateAsync({
      workoutExerciseId: exercise.workoutExerciseId,
      setNumber: set.setNumber,
      side: set.side,
      weight: row.weight ? Number(row.weight) : null,
      weightUnit: row.weight ? 'lb' : null,
      reps: row.reps ? Number(row.reps) : null,
      actualRir: row.actualRir ? Number(row.actualRir) : null,
      qualityRating: row.quality,
      painFlag: row.pain,
      completionStatus:
        exercise.qualityCap && row.quality != null && row.quality <= 2 ? 'partial' : 'completed',
    });
    updateRow(key, { logged: true });
    await playLightTap();
    onSetLogged(exercise.restLabel);
  }

  const recommendedLoad =
    liftKey && exerciseMax
      ? calculateRecommendedLoad({
          estimated1Rm: exerciseMax.estimated_1rm,
          prescribedPercentage: exercise.sets[0]?.load.value ?? 0,
          unit: exerciseMax.weight_unit,
        })
      : null;

  return (
    <Card className="mb-4">
      <View className="flex-row items-start justify-between mb-2">
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center gap-2 flex-wrap">
            {exercise.clusterLabel ? (
              <Badge
                label={`Cluster ${exercise.clusterId} · ${exercise.clusterLabel}`}
                tone="neutral"
              />
            ) : null}
            {exercise.qualityCap ? <Badge label="Quality cap" tone="gold" /> : null}
          </View>
          <AppText variant="h3" color="primary" style={{ marginTop: 6 }}>
            {exercise.order}. {exercise.name}
          </AppText>
          {exercise.notes ? (
            <AppText variant="bodySm" color="secondary" style={{ marginTop: 2 }}>
              {exercise.notes}
            </AppText>
          ) : null}
        </View>
        <Pressable onPress={() => setSubstitutionOpen((v) => !v)} hitSlop={8}>
          <AppText variant="bodySm" color="accent">
            Substitute
          </AppText>
        </Pressable>
      </View>

      {exercise.qualityCap ? (
        <AppText variant="bodySm" color="muted" style={{ marginBottom: 8 }}>
          Quality ends the set — stop as soon as reps lose quality. Fewer high-quality reps is not a
          failure.
        </AppText>
      ) : null}

      {recommendedLoad ? (
        <AppText variant="bodySm" color="accent" style={{ marginBottom: 8 }}>
          Recommended: {recommendedLoad.recommendedLoad} lb ({recommendedLoad.effectivePercentage}%
          of e1RM{recommendedLoad.wasCapped ? ', capped at 80%' : ''})
        </AppText>
      ) : null}

      {previousSets && previousSets.length > 0 ? (
        <AppText variant="bodySm" color="muted" style={{ marginBottom: 10 }}>
          Previous: {previousSets[0]?.weight ? `${previousSets[0].weight}lb × ` : ''}
          {previousSets[0]?.reps ?? '—'} reps
        </AppText>
      ) : null}

      {substitutionOpen ? <SubstitutionPicker sessionId={sessionId} exercise={exercise} /> : null}

      {exercise.sets.map((set) => {
        const key = setKey(exercise.key, set);
        const row = rows[key]!;
        return (
          <View key={key} className="flex-row items-center gap-2 mb-2 flex-wrap">
            <AppText variant="bodySm" color="secondary" style={{ width: 44 }}>
              {set.side ? set.side.slice(0, 1).toUpperCase() : `#${set.setNumber}`}
            </AppText>
            <AppText variant="bodySm" color="muted" style={{ width: 64 }}>
              {set.targetRepsDisplay}
            </AppText>
            <MiniInput
              value={row.weight}
              onChangeText={(v) => updateRow(key, { weight: v })}
              placeholder="lb"
            />
            <MiniInput
              value={row.reps}
              onChangeText={(v) => updateRow(key, { reps: v })}
              placeholder="reps"
              keyboardType="number-pad"
            />
            {set.load.type === 'rir' ? (
              <MiniInput
                value={row.actualRir}
                onChangeText={(v) => updateRow(key, { actualRir: v })}
                placeholder="RIR"
                width={48}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={row.logged ? 'Set logged' : 'Log set'}
              onPress={() => handleLog(set)}
              style={{
                minHeight: 40,
                minWidth: 40,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: row.logged ? semanticColor.success : semanticColor.accentPrimary,
              }}
            >
              <AppText variant="button" color="onAccent">
                {row.logged ? '✓' : '→'}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

function SubstitutionPicker({
  sessionId,
  exercise,
}: {
  sessionId: string;
  exercise: PlayerExercise;
}) {
  const addJournal = useAddJournalEntry(sessionId);
  const substitutions = useMemo(() => listSubstitutions().filter((s) => !s.isSafetyRule), []);

  return (
    <Card className="mb-3">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 8 }}>
        SUBSTITUTIONS SUPPORTED BY THIS PROGRAM
      </AppText>
      {substitutions.map((sub, i) => (
        <Pressable
          key={i}
          onPress={() =>
            addJournal.mutate({
              level: 'exercise',
              workoutExerciseId: exercise.workoutExerciseId,
              promptKey: 'substitution',
              content: JSON.stringify({
                original: exercise.name,
                missing: sub.missing,
                useInstead: sub.useInstead,
              }),
            })
          }
          style={{ paddingVertical: 8 }}
        >
          <AppText variant="bodySm" color="primary">
            No {sub.missing.toLowerCase()}? → {sub.useInstead}
          </AppText>
        </Pressable>
      ))}
      <AppText variant="bodySm" color="muted" style={{ marginTop: 8 }}>
        Pain that changes how you move is never a normal substitution — stop and see a qualified
        professional instead.
      </AppText>
    </Card>
  );
}

function SegmentChecklist({
  segments,
  sessionId,
}: {
  segments: PlayerSegment[];
  sessionId: string;
}) {
  const addJournal = useAddJournalEntry(sessionId);
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <>
      {segments.map((segment) => (
        <Card key={segment.key} className="mb-3">
          <View className="flex-row items-start justify-between">
            <View style={{ flex: 1 }}>
              <AppText variant="h3" color="primary" style={{ marginBottom: 4 }}>
                {segment.label}
              </AppText>
              <AppText variant="bodySm" color={segment.blocked ? 'danger' : 'secondary'}>
                {segment.blocked ? segment.blockedReason : segment.detail}
              </AppText>
            </View>
            {!segment.blocked ? (
              <Pressable
                onPress={() => {
                  setDone((d) => ({ ...d, [segment.key]: !d[segment.key] }));
                  addJournal.mutate({
                    level: 'exercise',
                    promptKey: `segment:${segment.key}`,
                    content: segment.label,
                  });
                }}
                style={{
                  minHeight: 36,
                  minWidth: 36,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done[segment.key] ? semanticColor.success : 'transparent',
                  borderWidth: 1.5,
                  borderColor: done[segment.key]
                    ? semanticColor.success
                    : semanticColor.borderSubtle,
                }}
              >
                <AppText variant="button" color={done[segment.key] ? 'onAccent' : 'muted'}>
                  ✓
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );
}

function RestTimerBanner({
  persistKey,
  durationMs,
  onDone,
}: {
  persistKey: string;
  durationMs: number;
  onDone: () => void;
}) {
  const timer = useTimer({ persistKey, durationMs, kind: 'rest', onComplete: onDone });

  useEffect(() => {
    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  return (
    <Card className="mb-4" emphasized>
      <View className="flex-row items-center justify-between">
        <View>
          <AppText variant="caption" color="secondary">
            REST
          </AppText>
          <AppText variant="h1" color="accent">
            {formatMs(timer.remainingMs ?? 0)}
          </AppText>
        </View>
        <View className="flex-row gap-2">
          <Button
            variant="secondary"
            fullWidth={false}
            onPress={timer.isRunning ? timer.pause : timer.resume}
          >
            {timer.isRunning ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              Alert.alert('Skip rest?', 'Skip the remaining rest time?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Skip', style: 'destructive', onPress: onDone },
              ])
            }
          >
            Skip
          </Button>
        </View>
      </View>
    </Card>
  );
}

export default function WorkoutPlayerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data, isLoading } = useWorkoutPlayerData(sessionId!);
  const startSession = useStartSession(sessionId!);
  const completeSession = useCompleteSession(sessionId!);
  const [activeRest, setActiveRest] = useState<{ key: string; durationMs: number } | null>(null);

  const sessionTimer = useTimer({ persistKey: `${sessionId}:session-elapsed`, kind: 'timer' });

  useEffect(() => {
    if (data?.session.status === 'scheduled') {
      startSession.mutate();
    }
    if (data?.session.started_at && !sessionTimer.isRunning && sessionTimer.elapsedMs === 0) {
      sessionTimer.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session.id]);

  if (isLoading || !data) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const { session, plan } = data;

  function handleSetLogged(exerciseKey: string, restLabel: string | null) {
    const ms = parseRestLabelToMs(restLabel);
    if (ms) setActiveRest({ key: exerciseKey, durationMs: ms });
  }

  async function handleFinish() {
    await completeSession.mutateAsync({
      durationActualSeconds: Math.round(sessionTimer.elapsedMs / 1000),
      completionPct: 100,
    });
    router.replace({ pathname: '/workout/[sessionId]/summary', params: { sessionId: session.id } });
  }

  function handleAbandon() {
    Alert.alert(
      'Abandon workout?',
      'Your logged sets are saved. You can resume this session later from Today.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Abandon', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  return (
    <Screen scroll>
      <View className="flex-row items-center justify-between mt-4 mb-4">
        <View>
          <AppText variant="overline" color="accent">
            {plan.title}
          </AppText>
          <AppText variant="h2" color="primary">
            {formatMs(sessionTimer.elapsedMs)}
          </AppText>
        </View>
        <Pressable onPress={handleAbandon} hitSlop={8}>
          <AppText variant="bodySm" color="muted">
            Exit
          </AppText>
        </Pressable>
      </View>

      {activeRest ? (
        <RestTimerBanner
          persistKey={`${sessionId}:${activeRest.key}:rest`}
          durationMs={activeRest.durationMs}
          onDone={() => setActiveRest(null)}
        />
      ) : null}

      {plan.supportsPerSetLogging ? (
        plan.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.key}
            exercise={exercise}
            sessionId={session.id}
            weekNumber={plan.weekNumber}
            strengthLetter={plan.strengthLetter}
            onSetLogged={(restLabel) => handleSetLogged(exercise.key, restLabel)}
          />
        ))
      ) : (
        <SegmentChecklist segments={plan.segments} sessionId={session.id} />
      )}

      <Divider className="my-4" />
      <Button onPress={handleFinish} loading={completeSession.isPending}>
        Complete workout
      </Button>
    </Screen>
  );
}
