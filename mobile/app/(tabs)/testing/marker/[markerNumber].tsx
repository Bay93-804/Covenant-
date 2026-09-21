import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  ChoiceGroup,
  Screen,
  TextField,
} from '../../../../src/design-system';
import { useEnrollmentSchedule } from '../../../../src/features/program/useEnrollmentSchedule';
import { useProfileSummary } from '../../../../src/lib/profile/useProfileSummary';
import { generateId, createExerciseMax } from '../../../../src/features/workout/workoutRepository';
import { useAuth } from '../../../../src/lib/auth/AuthContext';
import {
  computeE1rmFromHeavy5,
  feetInchesToInches,
  formatSecondsAsMmSs,
  getMarkerInputKind,
  parseFlexibleTime,
  parseMmSs,
  tierLabel,
} from '../../../../src/features/testing/markerFormats';
import type { MarkerSummary } from '../../../../src/features/testing/testingResultsAggregation';
import type { TestingResult } from '../../../../src/features/testing/types';
import type { TestingEventKey } from '../../../../src/features/testing/testingSchedule';
import {
  useMarkerHistory,
  useMaximalEffortSafetyGate,
  useRecordSprintDeferral,
  useSaveBodyweight,
  useTestingSession,
  useUpsertTestingResult,
} from '../../../../src/features/testing/useTesting';

const MAXIMAL_EFFORT_MARKERS = new Set([11, 12, 13, 14, 15]);
/** Sentinel attempt number reserved for the marker's freeform notes, distinct from any real attempt/component row. */
const MARKER_NOTES_ATTEMPT_NUMBER = 99;

function ResultBanner({ summary }: { summary: MarkerSummary }) {
  if (!summary.displayValue && !summary.isDeferred) return null;
  return (
    <Card className="mb-4" emphasized>
      <AppText variant="caption" color="secondary" style={{ marginBottom: 4 }}>
        SELECTED RESULT
      </AppText>
      {summary.isDeferred ? (
        <AppText variant="h3" color="primary">
          Deferred
        </AppText>
      ) : summary.bilateral ? (
        <>
          <AppText variant="h3" color="primary">
            {summary.displayValue}
          </AppText>
          <View style={{ marginTop: 6 }}>
            {summary.bilateral.leftClassification ? (
              <AppText variant="bodySm" color="accent">
                Left: {tierLabel(summary.bilateral.leftClassification)}
              </AppText>
            ) : null}
            {summary.bilateral.rightClassification ? (
              <AppText variant="bodySm" color="accent">
                Right: {tierLabel(summary.bilateral.rightClassification)}
              </AppText>
            ) : null}
            {summary.bilateral.difference != null ? (
              <AppText variant="bodySm" color="secondary" style={{ marginTop: 4 }}>
                Difference between sides: {summary.bilateral.difference}
                {summary.marker.unit === 's' ? 's' : ''}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color="muted" style={{ marginTop: 8 }}>
            No combined score — the source program gives one scale but no rule for combining left
            and right.
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="h3" color="primary">
            {summary.displayValue}
          </AppText>
          {summary.classification ? (
            <AppText variant="bodySm" color="accent" style={{ marginTop: 4 }}>
              {tierLabel(summary.classification)}
            </AppText>
          ) : null}
        </>
      )}
    </Card>
  );
}

function SafetyGateWarning({ testDate }: { testDate: string }) {
  const { data } = useMaximalEffortSafetyGate(testDate);
  if (!data?.blocked) return null;
  return (
    <Card className="mb-4" emphasized>
      <Badge label="Safety hold" tone="danger" />
      <AppText variant="body" color="primary" style={{ marginTop: 8, marginBottom: 4 }}>
        This is a maximal-effort test — the same safety rules that gate a training day&apos;s
        sprint/plyo work apply here.
      </AppText>
      {data.reasons.map((reason, i) => (
        <AppText key={i} variant="bodySm" color="secondary" style={{ marginTop: 4 }}>
          • {reason}
        </AppText>
      ))}
    </Card>
  );
}

function findAttempt(
  attempts: TestingResult[],
  attemptNumber: number,
  side: 'left' | 'right' | null = null,
): TestingResult | undefined {
  return attempts.find((a) => a.attempt_number === attemptNumber && a.side === side);
}

// ---------------------------------------------------------------------------

export default function MarkerEntryScreen() {
  const params = useLocalSearchParams<{
    markerNumber: string;
    eventKey: TestingEventKey;
    sessionId: string;
  }>();
  const markerNumber = Number(params.markerNumber);
  const { data, isLoading } = useTestingSession(params.eventKey);
  const { data: scheduleContext } = useEnrollmentSchedule();
  const upsert = useUpsertTestingResult();

  if (isLoading || !data || !scheduleContext) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const summary = data.summaries.get(markerNumber);
  if (!summary) {
    return (
      <Screen>
        <AppText variant="body" color="secondary" style={{ marginTop: 40 }}>
          This marker isn&apos;t part of {data.window.label}.
        </AppText>
      </Screen>
    );
  }

  const kind = getMarkerInputKind(markerNumber);
  const testDate = scheduleContext.todayIso;

  async function save(
    attemptNumber: number,
    fields: {
      side?: 'left' | 'right' | 'both' | null;
      valueNumeric?: number | null;
      valueText?: string | null;
      notes?: string | null;
    },
  ) {
    await upsert.mutateAsync({
      testingSessionId: data!.sessionId,
      markerNumber,
      attemptNumber,
      ...fields,
    });
  }

  return (
    <Screen scroll>
      <AppText variant="overline" color="accent" style={{ marginTop: 16 }}>
        MARKER #{markerNumber} · {data.window.label}
      </AppText>
      <AppText variant="h1" color="primary" style={{ marginBottom: 8 }}>
        {summary.marker.name}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginBottom: 6 }}>
        {summary.marker.protocol}
      </AppText>
      <AppText variant="bodySm" color="muted" style={{ marginBottom: 16 }}>
        Unit: {summary.marker.unit}
        {summary.marker.bilateral ? ' · Left and right recorded separately' : ''}
      </AppText>
      {summary.marker.caution ? (
        <Card className="mb-4">
          <AppText variant="bodySm" color="danger">
            {summary.marker.caution}
          </AppText>
        </Card>
      ) : null}

      <ResultBanner summary={summary} />
      {MAXIMAL_EFFORT_MARKERS.has(markerNumber) ? <SafetyGateWarning testDate={testDate} /> : null}

      {kind === 'mmss' ? (
        <MmssEntry summary={summary} onSave={(seconds) => save(1, { valueNumeric: seconds })} />
      ) : null}
      {kind === 'numeric' ? (
        <NumericEntry
          markerNumber={markerNumber}
          summary={summary}
          onSave={(value) => save(1, { valueNumeric: value })}
        />
      ) : null}
      {kind === 'time_flexible' ? (
        <TimeFlexibleEntry
          summary={summary}
          onSave={(seconds) => save(1, { valueNumeric: seconds })}
        />
      ) : null}
      {kind === 'qualitative' ? (
        <QualitativeEntry summary={summary} onSave={(text) => save(1, { valueText: text })} />
      ) : null}
      {kind === 'sprint_10yd' ? (
        <SprintEntry
          sessionId={data.sessionId}
          eventKey={data.eventKey}
          summary={summary}
          onSave={save}
        />
      ) : null}
      {kind === 'broad_jump' ? <BroadJumpEntry summary={summary} onSave={save} /> : null}
      {kind === 'cmj' ? <CmjEntry summary={summary} onSave={save} /> : null}
      {kind === 'pro_agility' ? <ProAgilityEntry summary={summary} onSave={save} /> : null}
      {kind === 'deceleration_deficit' ? (
        <DecelerationDeficitEntry summary={summary} onSave={save} />
      ) : null}
      {kind === 'bilateral_time' ? <BilateralTimeEntry summary={summary} onSave={save} /> : null}
      {kind === 'bilateral_attempts_time' ? (
        <BilateralAttemptsTimeEntry summary={summary} onSave={save} />
      ) : null}
      {kind === 'e1rm_heavy5' ? <E1rmEntry summary={summary} onSave={save} /> : null}

      <NotesField
        value={findAttempt(summary.attempts, MARKER_NOTES_ATTEMPT_NUMBER)?.notes ?? null}
        onSave={(notes) => save(MARKER_NOTES_ATTEMPT_NUMBER, { notes })}
      />

      <View style={{ marginTop: 12 }}>
        <Button variant="secondary" onPress={() => router.back()}>
          Done with this marker
        </Button>
      </View>
      <AppText variant="bodySm" color="muted" style={{ marginTop: 12 }}>
        Every value you enter is saved automatically as you type — you can close the app and pick up
        right where you left off.
      </AppText>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Per-input-kind sub-forms — each explicit to its marker's protocol.
// ---------------------------------------------------------------------------

function NotesField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (notes: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  return (
    <TextField
      label="Notes (optional)"
      value={draft}
      onChangeText={setDraft}
      onBlur={() => onSave(draft || null)}
      placeholder="Conditions, how it felt, anything worth remembering"
      multiline
    />
  );
}

function MmssEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: (seconds: number) => void;
}) {
  const existing = findAttempt(summary.attempts, 1);
  const [text, setText] = useState(
    existing?.value_numeric != null ? formatSecondsAsMmSs(existing.value_numeric) : '',
  );
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const seconds = parseMmSs(text);
    if (seconds == null) {
      setError('Enter a time as minutes:seconds, e.g. 12:45.');
      return;
    }
    setError(null);
    onSave(seconds);
  }

  return (
    <Card className="mb-4">
      <TextField
        label="Time (mm:ss)"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        placeholder="e.g. 12:45"
        error={error ?? undefined}
      />
    </Card>
  );
}

function NumericEntry({
  markerNumber,
  summary,
  onSave,
}: {
  markerNumber: number;
  summary: MarkerSummary;
  onSave: (value: number) => void;
}) {
  const existing = findAttempt(summary.attempts, 1);
  const [text, setText] = useState(
    existing?.value_numeric != null ? String(existing.value_numeric) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const isScore = markerNumber === 5; // sit-to-rise, score 0-10

  function commit() {
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid, non-negative number.');
      return;
    }
    if (isScore && (value > 10 || !Number.isInteger(value))) {
      setError('Sit-to-rise is a whole-number score from 0 to 10.');
      return;
    }
    setError(null);
    onSave(value);
  }

  return (
    <Card className="mb-4">
      <TextField
        label={`Result (${summary.marker.unit})`}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        error={error ?? undefined}
      />
    </Card>
  );
}

function TimeFlexibleEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: (seconds: number) => void;
}) {
  const existing = findAttempt(summary.attempts, 1);
  const [text, setText] = useState(
    existing?.value_numeric != null
      ? existing.value_numeric >= 60
        ? formatSecondsAsMmSs(existing.value_numeric)
        : `${existing.value_numeric}s`
      : '',
  );
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const seconds = parseFlexibleTime(text);
    if (seconds == null) {
      setError('Enter a time as seconds ("45s") or minutes:seconds ("2:00").');
      return;
    }
    setError(null);
    onSave(seconds);
  }

  return (
    <Card className="mb-4">
      <TextField
        label="Hold time"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        placeholder='e.g. "45s" or "2:00"'
        error={error ?? undefined}
      />
    </Card>
  );
}

function QualitativeEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: (text: string) => void;
}) {
  const existing = findAttempt(summary.attempts, 1);
  const value = existing?.value_text ?? undefined;
  const marker = summary.marker;
  return (
    <Card className="mb-4">
      <ChoiceGroup
        label="Result"
        value={value}
        onChange={onSave}
        options={[
          { value: String(marker.baseline), label: String(marker.baseline) },
          { value: String(marker.solid), label: String(marker.solid) },
          { value: String(marker.strong), label: String(marker.strong) },
        ]}
      />
    </Card>
  );
}

function AttemptField({
  label,
  value,
  onCommit,
  parse,
  format,
  error,
}: {
  label: string;
  value: number | undefined;
  onCommit: (n: number) => void;
  parse: (raw: string) => number | null;
  format: (n: number) => string;
  error?: string;
}) {
  const [text, setText] = useState(value != null ? format(value) : '');
  const [localError, setLocalError] = useState<string | null>(null);

  function commit() {
    if (!text.trim()) return;
    const parsed = parse(text);
    if (parsed == null || parsed < 0) {
      setLocalError('Enter a valid value.');
      return;
    }
    setLocalError(null);
    onCommit(parsed);
  }

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      keyboardType="decimal-pad"
      error={localError ?? error}
    />
  );
}

type AttemptSaveFn = (
  attemptNumber: number,
  fields: {
    side?: 'left' | 'right' | 'both' | null;
    valueNumeric?: number | null;
    valueText?: string | null;
    notes?: string | null;
  },
) => Promise<void>;

function SprintEntry({
  sessionId,
  eventKey,
  summary,
  onSave,
}: {
  sessionId: string;
  eventKey: TestingEventKey;
  summary: MarkerSummary;
  onSave: AttemptSaveFn;
}) {
  const recordDeferral = useRecordSprintDeferral();
  const { data: scheduleContext } = useEnrollmentSchedule();
  const [reason, setReason] = useState('');
  const [showDefer, setShowDefer] = useState(false);

  if (summary.isDeferred) {
    return (
      <Card className="mb-4">
        <Badge label="Deferred" tone="gold" />
        <AppText variant="bodySm" color="secondary" style={{ marginTop: 8 }}>
          {summary.notes ||
            'Deferred at Week 0. Complete it at Week 6 once Block 1 has prepared the tissue.'}
        </AppText>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        3 ATTEMPTS · LOWEST TIME WINS
      </AppText>
      {[1, 2, 3].map((n) => {
        const existing = findAttempt(summary.attempts, n);
        return (
          <View key={n} className="mb-2">
            <AttemptField
              label={`Attempt ${n} (seconds)`}
              value={existing?.value_numeric ?? undefined}
              parse={(raw) => {
                const v = Number(raw);
                return Number.isFinite(v) ? v : null;
              }}
              format={(v) => String(v)}
              onCommit={(v) => onSave(n, { valueNumeric: v })}
            />
          </View>
        );
      })}

      {eventKey === 'week0' && !showDefer ? (
        <Button variant="ghost" onPress={() => setShowDefer(true)}>
          I haven&apos;t sprinted at or near full effort recently — defer instead
        </Button>
      ) : null}

      {showDefer ? (
        <View style={{ marginTop: 8 }}>
          <TextField
            label="Reason for deferring"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Haven't sprinted at full effort since my twenties"
          />
          <Button
            variant="secondary"
            loading={recordDeferral.isPending}
            onPress={() =>
              recordDeferral.mutateAsync({
                testingSessionId: sessionId,
                reason: reason || 'Not ready to sprint at full effort yet.',
                deferredDate: scheduleContext?.todayIso ?? new Date().toISOString().slice(0, 10),
              })
            }
          >
            Confirm deferral to Week 6
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

function BroadJumpEntry({ summary, onSave }: { summary: MarkerSummary; onSave: AttemptSaveFn }) {
  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        3 ATTEMPTS · LONGEST JUMP WINS
      </AppText>
      {[1, 2, 3].map((n) => (
        <FeetInchesAttempt
          key={n}
          label={`Attempt ${n}`}
          attemptNumber={n}
          summary={summary}
          onSave={onSave}
        />
      ))}
    </Card>
  );
}

function FeetInchesAttempt({
  label,
  attemptNumber,
  summary,
  onSave,
}: {
  label: string;
  attemptNumber: number;
  summary: MarkerSummary;
  onSave: AttemptSaveFn;
}) {
  const existing = findAttempt(summary.attempts, attemptNumber);
  const existingFeet =
    existing?.value_numeric != null ? Math.floor(existing.value_numeric / 12) : undefined;
  const existingInches =
    existing?.value_numeric != null
      ? existing.value_numeric - Math.floor(existing.value_numeric / 12) * 12
      : undefined;
  const [feet, setFeet] = useState(existingFeet != null ? String(existingFeet) : '');
  const [inches, setInches] = useState(existingInches != null ? String(existingInches) : '');
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (!feet.trim() && !inches.trim()) return;
    const f = Number(feet || 0);
    const i = Number(inches || 0);
    if (!Number.isFinite(f) || !Number.isFinite(i) || f < 0 || i < 0 || i >= 12) {
      setError('Enter feet and inches (0–11).');
      return;
    }
    setError(null);
    onSave(attemptNumber, { valueNumeric: feetInchesToInches(f, i) });
  }

  return (
    <View className="flex-row gap-3 mb-2">
      <View style={{ flex: 1 }}>
        <TextField
          label={`${label} — feet`}
          keyboardType="number-pad"
          value={feet}
          onChangeText={setFeet}
          onBlur={commit}
          error={error ?? undefined}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          label="inches"
          keyboardType="number-pad"
          value={inches}
          onChangeText={setInches}
          onBlur={commit}
        />
      </View>
    </View>
  );
}

const CMJ_METHOD_LABEL: Record<string, string> = {
  hands_on_hips: 'Hands on hips',
  arm_swing: 'Arm swing',
};

function CmjEntry({ summary, onSave }: { summary: MarkerSummary; onSave: AttemptSaveFn }) {
  const methodRow = summary.attempts.find(
    (a) => a.value_text === 'hands_on_hips' || a.value_text === 'arm_swing',
  );
  const [method, setMethod] = useState<'hands_on_hips' | 'arm_swing' | undefined>(
    (methodRow?.value_text as 'hands_on_hips' | 'arm_swing' | undefined) ?? undefined,
  );

  // The method locked in at the athlete's very first recorded CMJ test,
  // across every event (Week 0/6/12) — see docs/phase1/EXTRACTION_AUDIT.md
  // item 8. A mismatch is a warning, never a hard block: the athlete can
  // still save a different method, but the Week 0/6/12 comparison marks
  // that pairing noncomparable rather than fabricating a verdict across two
  // different protocols.
  const { data: history } = useMarkerHistory(13);
  const lockedMethod = useMemo(() => {
    if (!history || history.length === 0) return null;
    const sorted = [...history].sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));
    const first = sorted.find(
      (r) => r.value_text === 'hands_on_hips' || r.value_text === 'arm_swing',
    );
    return (first?.value_text as 'hands_on_hips' | 'arm_swing' | undefined) ?? null;
  }, [history]);
  const methodMismatch = Boolean(lockedMethod && method && lockedMethod !== method);

  return (
    <Card className="mb-4">
      <ChoiceGroup
        label="Arm-swing method — lock this in and reuse it every retest"
        required
        value={method}
        onChange={(v) => setMethod(v)}
        options={[
          { value: 'hands_on_hips', label: 'Hands on hips' },
          { value: 'arm_swing', label: 'Arm swing' },
        ]}
      />
      {methodMismatch ? (
        <Card className="mb-4" emphasized>
          <Badge label="Method mismatch" tone="danger" />
          <AppText variant="bodySm" color="secondary" style={{ marginTop: 8 }}>
            Your first recorded test used &quot;{CMJ_METHOD_LABEL[lockedMethod!]}.&quot; This is a
            warning, not a block — you can still save this result, but it will be marked
            noncomparable against that baseline in the Week 0/6/12 comparison rather than shown as
            improved or declined.
          </AppText>
        </Card>
      ) : null}
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        3 ATTEMPTS · HIGHEST JUMP WINS
      </AppText>
      {[1, 2, 3].map((n) => {
        const existing = findAttempt(summary.attempts, n);
        return (
          <View key={n} className="mb-2">
            <AttemptField
              label={`Attempt ${n} (inches)`}
              value={existing?.value_numeric ?? undefined}
              parse={(raw) => {
                const v = Number(raw);
                return Number.isFinite(v) ? v : null;
              }}
              format={(v) => String(v)}
              onCommit={(v) => onSave(n, { valueNumeric: v, valueText: method ?? null })}
            />
          </View>
        );
      })}
    </Card>
  );
}

function ProAgilityEntry({ summary, onSave }: { summary: MarkerSummary; onSave: AttemptSaveFn }) {
  const attemptCount = summary.marker.attempts ?? 2;
  const attemptNumbers = Array.from({ length: attemptCount }, (_, i) => i + 1);

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        {attemptCount} ATTEMPTS EACH DIRECTION · FASTEST TIME WINS
      </AppText>
      {(['left', 'right'] as const).map((side) => (
        <View key={side} style={{ marginBottom: 12 }}>
          <AppText
            variant="bodySm"
            color="primary"
            style={{ marginBottom: 6, textTransform: 'capitalize' }}
          >
            {side}-start
          </AppText>
          {attemptNumbers.map((n) => {
            const existing = findAttempt(summary.attempts, n, side);
            return (
              <View key={n} className="mb-2">
                <AttemptField
                  label={`Attempt ${n} (seconds)`}
                  value={existing?.value_numeric ?? undefined}
                  parse={(raw) => {
                    const v = Number(raw);
                    return Number.isFinite(v) ? v : null;
                  }}
                  format={(v) => String(v)}
                  onCommit={(v) => onSave(n, { side, valueNumeric: v })}
                />
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function DecelerationDeficitEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: AttemptSaveFn;
}) {
  const stopRow = summary.attempts.find((a) => a.notes?.includes('sprint_and_stop'));
  const throughRow = summary.attempts.find((a) => a.notes?.includes('sprint_through'));
  return (
    <Card className="mb-4">
      <AttemptField
        label="Sprint-and-stop time, 10 yards (seconds)"
        value={stopRow?.value_numeric ?? undefined}
        parse={(raw) => {
          const v = Number(raw);
          return Number.isFinite(v) ? v : null;
        }}
        format={(v) => String(v)}
        onCommit={(v) => onSave(1, { valueNumeric: v, notes: 'sprint_and_stop_time_10yd' })}
      />
      <AttemptField
        label="Sprint-through time, 10 yards (seconds)"
        value={throughRow?.value_numeric ?? undefined}
        parse={(raw) => {
          const v = Number(raw);
          return Number.isFinite(v) ? v : null;
        }}
        format={(v) => String(v)}
        onCommit={(v) => onSave(2, { valueNumeric: v, notes: 'sprint_through_time_10yd' })}
      />
      {summary.comparableValue != null ? (
        <AppText variant="bodySm" color="accent" style={{ marginTop: 8 }}>
          Deceleration deficit: {summary.comparableValue}s
        </AppText>
      ) : null}
    </Card>
  );
}

function BilateralTimeEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: AttemptSaveFn;
}) {
  const left = findAttempt(summary.attempts, 1, 'left');
  const right = findAttempt(summary.attempts, 1, 'right');
  return (
    <Card className="mb-4">
      <AttemptField
        label="Left side (seconds)"
        value={left?.value_numeric ?? undefined}
        parse={(raw) => {
          const v = Number(raw);
          return Number.isFinite(v) ? v : null;
        }}
        format={(v) => String(v)}
        onCommit={(v) => onSave(1, { side: 'left', valueNumeric: v })}
      />
      <AttemptField
        label="Right side (seconds)"
        value={right?.value_numeric ?? undefined}
        parse={(raw) => {
          const v = Number(raw);
          return Number.isFinite(v) ? v : null;
        }}
        format={(v) => String(v)}
        onCommit={(v) => onSave(1, { side: 'right', valueNumeric: v })}
      />
      {left?.value_numeric != null && right?.value_numeric != null ? (
        <AppText variant="bodySm" color="secondary" style={{ marginTop: 8 }}>
          Difference between sides: {Math.abs(left.value_numeric - right.value_numeric).toFixed(1)}s
        </AppText>
      ) : null}
    </Card>
  );
}

function BilateralAttemptsTimeEntry({
  summary,
  onSave,
}: {
  summary: MarkerSummary;
  onSave: AttemptSaveFn;
}) {
  // Read the attempt count from the marker's own structured definition
  // (see docs/phase1/EXTRACTION_AUDIT.md item 11) rather than hardcoding it.
  const attemptCount = summary.marker.attempts ?? 2;
  const attemptNumbers = Array.from({ length: attemptCount }, (_, i) => i + 1);

  return (
    <Card className="mb-4">
      <AppText variant="caption" color="secondary" style={{ marginBottom: 10 }}>
        BEST OF {attemptCount} PER SIDE
      </AppText>
      {(['left', 'right'] as const).map((side) => (
        <View key={side} style={{ marginBottom: 12 }}>
          <AppText
            variant="bodySm"
            color="primary"
            style={{ marginBottom: 6, textTransform: 'capitalize' }}
          >
            {side}
          </AppText>
          {attemptNumbers.map((n) => {
            const existing = findAttempt(summary.attempts, n, side);
            return (
              <View key={n} className="mb-2">
                <AttemptField
                  label={`Attempt ${n} (seconds)`}
                  value={existing?.value_numeric ?? undefined}
                  parse={(raw) => {
                    const v = Number(raw);
                    return Number.isFinite(v) ? v : null;
                  }}
                  format={(v) => String(v)}
                  onCommit={(v) => onSave(n, { side, valueNumeric: v })}
                />
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function E1rmEntry({ summary, onSave }: { summary: MarkerSummary; onSave: AttemptSaveFn }) {
  const { user } = useAuth();
  const { data: profile } = useProfileSummary();
  const saveBodyweight = useSaveBodyweight();
  const existing = findAttempt(summary.attempts, 1);
  const [weight, setWeight] = useState(
    existing?.value_numeric != null ? String(existing.value_numeric) : '',
  );
  const [bodyweight, setBodyweight] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const heavy5 = Number(weight);
    if (!Number.isFinite(heavy5) || heavy5 <= 0) {
      setError('Enter the weight used on the heavy set of 5.');
      return;
    }
    setError(null);
    await onSave(1, { valueNumeric: heavy5 });
    if (user) {
      const e1rm = computeE1rmFromHeavy5(heavy5);
      await createExerciseMax({
        id: generateId(),
        userId: user.id,
        liftKey: 'trap_bar_deadlift',
        estimated1Rm: e1rm,
        weightUnit: profile?.unitsWeight ?? 'lb',
        method: 'heavy_5_rir1_x1.15',
        source: 'testing_session',
      });
    }
  }

  async function commitBodyweight() {
    const bw = Number(bodyweight);
    if (!Number.isFinite(bw) || bw <= 0) return;
    await saveBodyweight.mutateAsync(bw);
  }

  return (
    <Card className="mb-4">
      <TextField
        label={`Heavy set of 5 weight, RIR 1 (${profile?.unitsWeight ?? 'lb'})`}
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
        onBlur={commit}
        error={error ?? undefined}
      />
      {existing?.value_numeric != null ? (
        <AppText variant="bodySm" color="secondary" style={{ marginBottom: 12 }}>
          Estimated 1RM: {computeE1rmFromHeavy5(existing.value_numeric)}{' '}
          {profile?.unitsWeight ?? 'lb'} (× 1.15, rounded to nearest 5)
        </AppText>
      ) : null}
      <TextField
        label={`Bodyweight (${profile?.unitsWeight ?? 'lb'}) — needed to classify this result`}
        keyboardType="decimal-pad"
        value={bodyweight}
        onChangeText={setBodyweight}
        onBlur={commitBodyweight}
        hint="Saved to your profile. Classification against baseline/solid/strong needs this."
      />
    </Card>
  );
}
