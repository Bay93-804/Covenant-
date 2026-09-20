/**
 * React hook wrapping the pure timer engine with:
 *  - a UI re-render tick (setInterval, purely cosmetic — the actual elapsed/
 *    remaining values are always recomputed from timestamps, never from the
 *    tick count, so a missed tick during backgrounding never desyncs the
 *    displayed time),
 *  - persistence to AsyncStorage so a rest/exercise timer survives the app
 *    being killed and restarted mid-set,
 *  - completion feedback (sound + haptic; see feedback.ts),
 *  - re-sync on `AppState` foreground, so the displayed time snaps to
 *    correct the instant the app returns rather than waiting for the next
 *    tick.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { playRestTimerCompleteFeedback, playTimerCompleteFeedback } from './feedback';
import {
  createTimerState,
  getElapsedMs,
  getRemainingMs,
  isComplete,
  isRunning,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
  type TimerState,
} from './timerEngine';

const STORAGE_PREFIX = 'coachconde.timer';

async function loadPersisted(key: string): Promise<TimerState | null> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

async function savePersisted(key: string, state: TimerState): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(state));
  } catch {
    // Persistence is best-effort — a failed write just means this one timer
    // won't restore after a kill, not a crash.
  }
}

export async function clearPersistedTimer(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}:${key}`);
  } catch {
    // best-effort
  }
}

export interface UseTimerOptions {
  /** Unique per timer instance — e.g. `${sessionId}:${exerciseKey}:rest`. */
  persistKey: string;
  /** Set for a countdown (rest) timer; leave null for a count-up (exercise/run) timer. */
  durationMs?: number | null;
  kind?: 'timer' | 'rest';
  onComplete?: () => void;
  tickMs?: number;
}

export interface UseTimerResult {
  elapsedMs: number;
  remainingMs: number | null;
  isComplete: boolean;
  isRunning: boolean;
  /** True once the persisted state (if any) has been loaded — avoids a flash of "0:00" before restoration completes. */
  restored: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer({
  persistKey,
  durationMs = null,
  kind = 'timer',
  onComplete,
  tickMs = 250,
}: UseTimerOptions): UseTimerResult {
  const [state, setState] = useState<TimerState>(() => createTimerState(durationMs));
  const [now, setNow] = useState(() => Date.now());
  const [restored, setRestored] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadPersisted(persistKey).then((saved) => {
      if (!mounted) return;
      if (saved) setState(saved);
      setRestored(true);
      setNow(Date.now());
    });
    return () => {
      mounted = false;
    };
  }, [persistKey]);

  useEffect(() => {
    if (!restored) return;
    savePersisted(persistKey, state);
  }, [state, persistKey, restored]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), tickMs);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [tickMs]);

  const elapsedMs = getElapsedMs(state, now);
  const remainingMs = getRemainingMs(state, now);
  const complete = isComplete(state, now);
  const running = isRunning(state);

  useEffect(() => {
    if (complete && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
      (kind === 'rest' ? playRestTimerCompleteFeedback() : playTimerCompleteFeedback()).catch(
        () => {},
      );
    }
    if (!complete) completedRef.current = false;
  }, [complete, kind, onComplete]);

  const start = useCallback(() => setState((s) => startTimer(s, Date.now())), []);
  const pause = useCallback(() => setState((s) => pauseTimer(s, Date.now())), []);
  const resume = useCallback(() => setState((s) => resumeTimer(s, Date.now())), []);
  const reset = useCallback(() => {
    setState((s) => resetTimer(s));
    clearPersistedTimer(persistKey).catch(() => {});
  }, [persistKey]);

  return {
    elapsedMs,
    remainingMs,
    isComplete: complete,
    isRunning: running,
    restored,
    start,
    pause,
    resume,
    reset,
  };
}
