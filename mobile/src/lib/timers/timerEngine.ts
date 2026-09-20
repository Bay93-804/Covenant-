/**
 * Pure, timestamp-based timer state. No `setInterval` here — the whole point
 * is that `getElapsedMs`/`getRemainingMs` are plain functions of
 * (state, now), so a timer's displayed value is always correct immediately
 * after the app returns from the background or restarts, rather than
 * depending on an interval callback having kept firing while backgrounded
 * (which the OS does not guarantee). A `TimerState` is plain JSON, so it can
 * be persisted (AsyncStorage) and restored verbatim.
 */
export interface TimerState {
  startedAtMs: number | null;
  pausedAtMs: number | null;
  accumulatedPausedMs: number;
  /** null = count-up (exercise/run timer); a number = countdown (rest timer), in ms. */
  durationMs: number | null;
}

export function createTimerState(durationMs: number | null = null): TimerState {
  return { startedAtMs: null, pausedAtMs: null, accumulatedPausedMs: 0, durationMs };
}

export function startTimer(state: TimerState, nowMs: number): TimerState {
  if (state.startedAtMs != null) return state;
  return { ...state, startedAtMs: nowMs, pausedAtMs: null, accumulatedPausedMs: 0 };
}

export function pauseTimer(state: TimerState, nowMs: number): TimerState {
  if (state.startedAtMs == null || state.pausedAtMs != null) return state;
  return { ...state, pausedAtMs: nowMs };
}

export function resumeTimer(state: TimerState, nowMs: number): TimerState {
  if (state.pausedAtMs == null) return state;
  const pausedDuration = nowMs - state.pausedAtMs;
  return {
    ...state,
    pausedAtMs: null,
    accumulatedPausedMs: state.accumulatedPausedMs + pausedDuration,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return { ...state, startedAtMs: null, pausedAtMs: null, accumulatedPausedMs: 0 };
}

export function isRunning(state: TimerState): boolean {
  return state.startedAtMs != null && state.pausedAtMs == null;
}

export function getElapsedMs(state: TimerState, nowMs: number): number {
  if (state.startedAtMs == null) return 0;
  const end = state.pausedAtMs ?? nowMs;
  return Math.max(0, end - state.startedAtMs - state.accumulatedPausedMs);
}

export function getRemainingMs(state: TimerState, nowMs: number): number | null {
  if (state.durationMs == null) return null;
  return Math.max(0, state.durationMs - getElapsedMs(state, nowMs));
}

export function isComplete(state: TimerState, nowMs: number): boolean {
  if (state.durationMs == null || state.startedAtMs == null) return false;
  return getRemainingMs(state, nowMs) === 0;
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Parses a rest-label like "75s" or "2:00" into milliseconds — used to seed a rest timer's countdown. */
export function parseRestLabelToMs(label: string | null | undefined): number | null {
  if (!label) return null;
  const trimmed = label.trim();
  const colonMatch = trimmed.match(/^(\d+):(\d{2})$/);
  if (colonMatch) {
    const minutes = Number(colonMatch[1]);
    const seconds = Number(colonMatch[2]);
    return (minutes * 60 + seconds) * 1000;
  }
  const secondsMatch = trimmed.match(/^(\d+)\s*s$/i);
  if (secondsMatch) {
    return Number(secondsMatch[1]) * 1000;
  }
  const bareNumber = trimmed.match(/^(\d+)$/);
  if (bareNumber) {
    return Number(bareNumber[1]) * 1000;
  }
  return null;
}
