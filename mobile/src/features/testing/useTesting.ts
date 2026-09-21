/**
 * React Query wiring for the Testing tab — combines the testing schedule
 * engine, the testing repository, and the results aggregation layer into
 * everything the Testing Hub / session / marker-entry screens need. Mirrors
 * the pattern `src/features/program/useTodaySessions.ts` and
 * `src/features/readiness/useReadinessGate.ts` established in Phase 3.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../lib/auth/AuthContext';
import { getBodyweightLb, setBodyweightLb } from '../../lib/profile/bodyweightService';
import { useEnrollmentSchedule } from '../program/useEnrollmentSchedule';
import { addDays } from '../schedule/dateUtils';
import { listReadinessHistory } from '../workout/workoutRepository';
import {
  evaluateMaximalEffortSafetyGate,
  type MaximalEffortSafetyResult,
} from './testingSafetyGate';
import {
  computeEstablishedRhr,
  computeRhrProgress,
  listRhrReadings,
  recordRhrReading as recordRhrReadingRepo,
  type EstablishedRhr,
  type RhrMorningProgress,
  type RhrReading,
} from './rhrWorkflow';
import {
  getSprintDeferral,
  recordSprintDeferral as recordSprintDeferralRepo,
} from './sprintDeferral';
import {
  buildTestingComparison,
  isEventFullyComplete,
  markerEntryState,
  summarizeSessionResults,
  type MarkerComparison,
  type MarkerEntryState,
  type MarkerSummary,
} from './testingResultsAggregation';
import {
  buildTestingWindows,
  computeTestingWindowState,
  type TestingEventKey,
  type TestingWindow,
  type TestingWindowState,
} from './testingSchedule';
import {
  completeTestingSession,
  getOrCreateTestingSession,
  getTestingSession,
  listTestingResultsForMarker,
  listTestingResultsForSession,
  startTestingSession,
  upsertTestingResult,
} from './testingRepository';
import type { TestingResult } from './types';

const EVENT_KEYS: TestingEventKey[] = ['week0', 'week6', 'week12'];

// ---------------------------------------------------------------------------
// Testing Hub — all three events at a glance
// ---------------------------------------------------------------------------

export interface TestingEventCardData {
  eventKey: TestingEventKey;
  label: string;
  markers: number[];
  window: TestingWindow;
  state: TestingWindowState;
  completedMarkers: number;
  deferredMarkers: number;
  totalMarkers: number;
  sessionId: string | null;
}

async function fetchTestingHub(
  userId: string,
  enrollmentId: string,
  scheduleInput: Parameters<typeof buildTestingWindows>[0],
  todayIso: string,
): Promise<TestingEventCardData[]> {
  const windows = buildTestingWindows(scheduleInput);
  const bodyweightLb = await getBodyweightLb(userId);

  const week0Session = await getTestingSession(userId, enrollmentId, 'week0');
  const week0Results = week0Session
    ? await listTestingResultsForSession(userId, week0Session.id)
    : [];
  const week0Deferral = week0Session ? await getSprintDeferral(userId, week0Session.id) : null;
  const sprintDeferredAtWeek0 = Boolean(week0Deferral);

  const cards: TestingEventCardData[] = [];
  for (const key of EVENT_KEYS) {
    const window = windows[key];
    const markers =
      key === 'week6' && sprintDeferredAtWeek0 && !window.markers.includes(11)
        ? [...window.markers, 11].sort((a, b) => a - b)
        : window.markers;

    const session =
      key === 'week0' ? week0Session : await getTestingSession(userId, enrollmentId, key);
    const results =
      key === 'week0'
        ? week0Results
        : session
          ? await listTestingResultsForSession(userId, session.id)
          : [];
    const summaries = summarizeSessionResults(markers, results, { bodyweightLb });

    const completedMarkers = markers.filter((m) => summaries.get(m)?.hasResult).length;
    const deferredMarkers = markers.filter((m) => summaries.get(m)?.isDeferred).length;

    const rawState = computeTestingWindowState(
      window,
      todayIso,
      session ? { startedAt: session.started_at, completedAt: session.completed_at } : null,
    );

    cards.push({
      eventKey: key,
      label: window.label,
      markers,
      window,
      state: rawState,
      completedMarkers,
      deferredMarkers,
      totalMarkers: markers.length,
      sessionId: session?.id ?? null,
    });
  }
  return cards;
}

export function useTestingHub() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: ['testing-hub', user?.id, scheduleContext?.enrollmentId, scheduleContext?.todayIso],
    queryFn: () =>
      fetchTestingHub(
        user!.id,
        scheduleContext!.enrollmentId,
        scheduleContext!.scheduleInput,
        scheduleContext!.todayIso,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}

export function useInvalidateTestingHub() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['testing-hub', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['testing-session', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['testing-comparison', user?.id] });
  };
}

// ---------------------------------------------------------------------------
// A single event's session + marker checklist
// ---------------------------------------------------------------------------

export interface TestingSessionData {
  sessionId: string;
  eventKey: TestingEventKey;
  markers: number[];
  window: TestingWindow;
  startedAt: string | null;
  completedAt: string | null;
  results: TestingResult[];
  summaries: Map<number, MarkerSummary>;
  entryStates: Map<number, MarkerEntryState>;
  isFullyComplete: boolean;
  rhrReadings: RhrReading[];
  rhrProgress: RhrMorningProgress;
  establishedRhr: EstablishedRhr | null;
  sprintDeferred: boolean;
  sprintDeferralReason: string | null;
}

async function fetchTestingSession(
  userId: string,
  enrollmentId: string,
  eventKey: TestingEventKey,
  scheduleInput: Parameters<typeof buildTestingWindows>[0],
): Promise<TestingSessionData> {
  const windows = buildTestingWindows(scheduleInput);
  const window = windows[eventKey];

  const week0Session = await getTestingSession(userId, enrollmentId, 'week0');
  const week0Deferral = week0Session ? await getSprintDeferral(userId, week0Session.id) : null;
  const sprintDeferredAtWeek0 = Boolean(week0Deferral);

  const markers =
    eventKey === 'week6' && sprintDeferredAtWeek0 && !window.markers.includes(11)
      ? [...window.markers, 11].sort((a, b) => a - b)
      : window.markers;

  const session = await getOrCreateTestingSession({
    id: '',
    userId,
    enrollmentId,
    eventKey,
    scheduledDate: window.windowStart,
  });

  const results = await listTestingResultsForSession(userId, session.id);
  const bodyweightLb = await getBodyweightLb(userId);
  const summaries = summarizeSessionResults(markers, results, { bodyweightLb });
  const entryStates = new Map(markers.map((m) => [m, markerEntryState(summaries.get(m)!)]));

  const rhrReadings = eventKey === 'week0' ? await listRhrReadings(userId, session.id) : [];
  const rhrProgress = computeRhrProgress(rhrReadings);
  const establishedRhr = computeEstablishedRhr(rhrReadings);

  const deferral = eventKey === 'week0' ? week0Deferral : null;

  return {
    sessionId: session.id,
    eventKey,
    markers,
    window,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    results,
    summaries,
    entryStates,
    isFullyComplete: isEventFullyComplete(markers, summaries),
    rhrReadings,
    rhrProgress,
    establishedRhr,
    sprintDeferred: eventKey === 'week0' ? sprintDeferredAtWeek0 : false,
    sprintDeferralReason: deferral?.reason ?? null,
  };
}

export function useTestingSession(eventKey: TestingEventKey) {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: ['testing-session', user?.id, scheduleContext?.enrollmentId, eventKey],
    queryFn: () =>
      fetchTestingSession(
        user!.id,
        scheduleContext!.enrollmentId,
        eventKey,
        scheduleContext!.scheduleInput,
      ),
    enabled: Boolean(user && scheduleContext),
  });
}

export function useStartTestingSession() {
  const { user } = useAuth();
  const invalidate = useInvalidateTestingHub();
  return useMutation({
    mutationFn: (sessionId: string) => startTestingSession(user!.id, sessionId),
    onSuccess: invalidate,
  });
}

export function useFinalizeTestingSession() {
  const { user } = useAuth();
  const invalidate = useInvalidateTestingHub();
  return useMutation({
    mutationFn: (sessionId: string) => completeTestingSession(user!.id, sessionId),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Marker-result entry
// ---------------------------------------------------------------------------

export function useUpsertTestingResult() {
  const { user } = useAuth();
  const invalidate = useInvalidateTestingHub();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof upsertTestingResult>[0], 'userId'>) =>
      upsertTestingResult({ ...input, userId: user!.id }),
    onSuccess: invalidate,
  });
}

export function useSaveBodyweight() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (bodyweightLb: number) => setBodyweightLb(user!.id, bodyweightLb),
  });
}

// ---------------------------------------------------------------------------
// RHR + sprint deferral
// ---------------------------------------------------------------------------

export function useRecordRhrReading() {
  const { user } = useAuth();
  const invalidate = useInvalidateTestingHub();
  return useMutation({
    mutationFn: (params: {
      testingSessionId: string;
      morningDate: string;
      bpm: number;
      allowCorrection?: boolean;
    }) => recordRhrReadingRepo({ ...params, userId: user!.id }),
    onSuccess: invalidate,
  });
}

export function useRecordSprintDeferral() {
  const { user } = useAuth();
  const invalidate = useInvalidateTestingHub();
  return useMutation({
    mutationFn: (params: { testingSessionId: string; reason: string; deferredDate: string }) =>
      recordSprintDeferralRepo({ ...params, userId: user!.id }),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Week 0 vs Week 6 vs Week 12 comparison
// ---------------------------------------------------------------------------

async function fetchTestingComparison(
  userId: string,
  enrollmentId: string,
): Promise<MarkerComparison[]> {
  const bodyweightLb = await getBodyweightLb(userId);
  const resultsByEvent: Record<TestingEventKey, TestingResult[]> = {
    week0: [],
    week6: [],
    week12: [],
  };
  for (const key of EVENT_KEYS) {
    const session = await getTestingSession(userId, enrollmentId, key);
    resultsByEvent[key] = session ? await listTestingResultsForSession(userId, session.id) : [];
  }
  return buildTestingComparison(resultsByEvent, { bodyweightLb });
}

// ---------------------------------------------------------------------------
// Established resting heart rate — feeds the daily readiness check
// (src/features/readiness/readinessRules.ts's `baselineRestingHr` input).
// Prefers the most recently *established* (3-morning-averaged) value across
// Week 12 → Week 6 → Week 0, since marker #1's protocol ("morning, before
// rising, 3 days averaged") applies at every retest, not only Week 0.
// ---------------------------------------------------------------------------

export interface EstablishedRhrWithSource extends EstablishedRhr {
  sourceEvent: TestingEventKey;
}

async function fetchEstablishedRestingHeartRate(
  userId: string,
  enrollmentId: string,
): Promise<EstablishedRhrWithSource | null> {
  for (const key of ['week12', 'week6', 'week0'] as TestingEventKey[]) {
    const session = await getTestingSession(userId, enrollmentId, key);
    if (!session) continue;
    const readings = await listRhrReadings(userId, session.id);
    const established = computeEstablishedRhr(readings);
    if (established) return { ...established, sourceEvent: key };
  }
  return null;
}

export function useEstablishedRestingHeartRate() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: ['established-rhr', user?.id, scheduleContext?.enrollmentId],
    queryFn: () => fetchEstablishedRestingHeartRate(user!.id, scheduleContext!.enrollmentId),
    enabled: Boolean(user && scheduleContext),
  });
}

// ---------------------------------------------------------------------------
// Maximal-effort safety gate (Athletic Five markers #11-15)
// ---------------------------------------------------------------------------

async function fetchMaximalEffortSafetyGate(
  userId: string,
  testDateIso: string,
): Promise<MaximalEffortSafetyResult> {
  const history = await listReadinessHistory(userId, addDays(testDateIso, -4), testDateIso);
  const latest = history[history.length - 1] ?? null;
  return evaluateMaximalEffortSafetyGate(
    latest
      ? {
          calfAchillesFlag: latest.calf_achilles_flag,
          hamstringGrabbyFlag: latest.hamstring_grabby_flag,
          jointPainFlag: latest.joint_pain_flag,
          jointPainLocation: latest.joint_pain_location,
        }
      : null,
    testDateIso,
    history.slice(0, -1).map((h) => ({
      entryDate: h.entry_date,
      restingHr: h.resting_hr,
      baselineRestingHr: h.baseline_resting_hr,
      calfAchillesFlag: h.calf_achilles_flag,
    })),
  );
}

export function useMaximalEffortSafetyGate(testDateIso: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['maximal-effort-safety-gate', user?.id, testDateIso],
    queryFn: () => fetchMaximalEffortSafetyGate(user!.id, testDateIso),
    enabled: Boolean(user && testDateIso),
  });
}

// ---------------------------------------------------------------------------
// Individual marker history — every raw attempt ever recorded, across every
// testing session (Week 0/6/12), for the marker-detail history screen.
// ---------------------------------------------------------------------------

export function useMarkerHistory(markerNumber: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['testing-marker-history', user?.id, markerNumber],
    queryFn: () => listTestingResultsForMarker(user!.id, markerNumber),
    enabled: Boolean(user),
  });
}

export function useTestingComparison() {
  const { user } = useAuth();
  const { data: scheduleContext } = useEnrollmentSchedule();
  return useQuery({
    queryKey: ['testing-comparison', user?.id, scheduleContext?.enrollmentId],
    queryFn: () => fetchTestingComparison(user!.id, scheduleContext!.enrollmentId),
    enabled: Boolean(user && scheduleContext),
  });
}
