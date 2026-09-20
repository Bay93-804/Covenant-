import {
  createTimerState,
  formatMs,
  getElapsedMs,
  getRemainingMs,
  isComplete,
  isRunning,
  parseRestLabelToMs,
  pauseTimer,
  resetTimer,
  resumeTimer,
  startTimer,
} from '../src/lib/timers/timerEngine';

describe('timerEngine (count-up)', () => {
  it('reports zero elapsed before starting', () => {
    const state = createTimerState();
    expect(getElapsedMs(state, 10_000)).toBe(0);
    expect(isRunning(state)).toBe(false);
  });

  it('computes elapsed as a pure function of timestamps — no interval required', () => {
    let state = createTimerState();
    state = startTimer(state, 1_000);
    // "app backgrounded for 30s" — nothing ticked, but elapsed is still correct.
    expect(getElapsedMs(state, 31_000)).toBe(30_000);
  });

  it('pause/resume excludes paused time from elapsed', () => {
    let state = createTimerState();
    state = startTimer(state, 0);
    state = pauseTimer(state, 5_000); // ran 5s
    expect(getElapsedMs(state, 20_000)).toBe(5_000); // frozen while paused
    state = resumeTimer(state, 20_000); // paused for 15s
    expect(getElapsedMs(state, 25_000)).toBe(10_000); // 5s + 5s more running
  });

  it('reset clears the timer back to not-started', () => {
    let state = createTimerState();
    state = startTimer(state, 0);
    state = resetTimer(state);
    expect(isRunning(state)).toBe(false);
    expect(getElapsedMs(state, 5_000)).toBe(0);
  });

  it('starting an already-started timer is a no-op (does not reset the clock)', () => {
    let state = createTimerState();
    state = startTimer(state, 1_000);
    state = startTimer(state, 5_000);
    expect(getElapsedMs(state, 6_000)).toBe(5_000); // still counted from 1_000, not 5_000
  });
});

describe('timerEngine (countdown / rest timer)', () => {
  it('counts down and reports completion at zero, background-safe', () => {
    let state = createTimerState(60_000); // 60s rest
    state = startTimer(state, 0);
    expect(getRemainingMs(state, 0)).toBe(60_000);
    expect(getRemainingMs(state, 30_000)).toBe(30_000);
    // App backgrounded for the remaining 40s — no ticks happened, still correct on return.
    expect(getRemainingMs(state, 70_000)).toBe(0);
    expect(isComplete(state, 70_000)).toBe(true);
  });

  it('is not complete before it starts, even with a duration set', () => {
    const state = createTimerState(30_000);
    expect(isComplete(state, 100_000)).toBe(false);
  });
});

describe('formatMs', () => {
  it('formats minutes:seconds, rounding up to avoid a flash of 0:00 before actual completion', () => {
    expect(formatMs(59_500)).toBe('1:00');
    expect(formatMs(5_000)).toBe('0:05');
    expect(formatMs(0)).toBe('0:00');
  });
});

describe('parseRestLabelToMs', () => {
  it('parses seconds-suffixed labels', () => {
    expect(parseRestLabelToMs('75s')).toBe(75_000);
    expect(parseRestLabelToMs('60s')).toBe(60_000);
  });

  it('parses minute:second labels', () => {
    expect(parseRestLabelToMs('2:00')).toBe(120_000);
    expect(parseRestLabelToMs('1:30')).toBe(90_000);
  });

  it('returns null for missing or unparseable labels', () => {
    expect(parseRestLabelToMs(null)).toBeNull();
    expect(parseRestLabelToMs(undefined)).toBeNull();
    expect(parseRestLabelToMs('as needed')).toBeNull();
  });
});
