/**
 * Cross-week exercise history + personal-best detection.
 *
 * `completed_sets.workout_exercise_id` is deterministically derived per
 * (strength letter, week number, exercise order) — see
 * src/content/contentIds.ts — so the *same* real-world exercise (e.g.
 * "Trap-Bar Deadlift" in every Strength A week) has a different id every
 * week. Continuity across weeks is therefore established by exercise name,
 * resolved by the caller via `src/features/workout/sessionPlanBuilder.ts`
 * (see `src/features/progress/useProgress.ts`) before this pure aggregation
 * runs. Only comparable logged values ever produce a "best": weight only
 * compares against weight, reps against reps, and a value missing from a
 * set is skipped rather than treated as zero.
 */
export interface NamedCompletedSet {
  exerciseName: string;
  sessionId: string;
  scheduledDate: string;
  weekNumber: number;
  setNumber: number;
  side: 'left' | 'right' | 'both' | null;
  weight: number | null;
  weightUnit: string | null;
  reps: number | null;
  actualRir: number | null;
  timeSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  sprintTime: number | null;
  completionStatus: string;
}

export interface PersonalBest {
  value: number;
  unit: string;
  date: string;
  weekNumber: number;
}

export interface SessionVolumePoint {
  date: string;
  weekNumber: number;
  /** Sum of weight × reps across sets that logged both — null when no set in this session has both. */
  totalVolume: number | null;
}

export interface ExerciseHistoryEntry {
  name: string;
  totalSetsLogged: number;
  firstLoggedDate: string;
  lastLoggedDate: string;
  records: NamedCompletedSet[];
  bestWeight: PersonalBest | null;
  bestReps: PersonalBest | null;
  bestDistance: PersonalBest | null;
  /** Longest hold — used for plank/isometric-style time_seconds entries, where longer is the improvement (see docs/phase4/IMPLEMENTATION_NOTES.md for why time_seconds is treated as "longer is better" here rather than a timed-interval). */
  bestHoldSeconds: PersonalBest | null;
  /** Fastest sprint — lower is better. */
  bestSprintTime: PersonalBest | null;
  volumeBySession: SessionVolumePoint[];
}

function bestNumeric(
  records: NamedCompletedSet[],
  select: (r: NamedCompletedSet) => number | null,
  unit: (r: NamedCompletedSet) => string,
  mode: 'max' | 'min',
): PersonalBest | null {
  let best: PersonalBest | null = null;
  for (const r of records) {
    const value = select(r);
    if (value == null) continue;
    if (!best || (mode === 'max' ? value > best.value : value < best.value)) {
      best = { value, unit: unit(r), date: r.scheduledDate, weekNumber: r.weekNumber };
    }
  }
  return best;
}

function computeVolumeBySession(records: NamedCompletedSet[]): SessionVolumePoint[] {
  const bySession = new Map<
    string,
    { date: string; weekNumber: number; sets: NamedCompletedSet[] }
  >();
  for (const r of records) {
    const existing = bySession.get(r.sessionId);
    if (existing) existing.sets.push(r);
    else bySession.set(r.sessionId, { date: r.scheduledDate, weekNumber: r.weekNumber, sets: [r] });
  }
  return Array.from(bySession.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date, weekNumber, sets }) => {
      const withBoth = sets.filter((s) => s.weight != null && s.reps != null);
      const totalVolume =
        withBoth.length > 0 ? withBoth.reduce((sum, s) => sum + s.weight! * s.reps!, 0) : null;
      return { date, weekNumber, totalVolume };
    });
}

export function buildExerciseHistory(sets: NamedCompletedSet[]): ExerciseHistoryEntry[] {
  const byName = new Map<string, NamedCompletedSet[]>();
  for (const s of sets) {
    if (s.completionStatus === 'skipped') continue;
    const list = byName.get(s.exerciseName) ?? [];
    list.push(s);
    byName.set(s.exerciseName, list);
  }

  const entries: ExerciseHistoryEntry[] = [];
  for (const [name, unsorted] of byName) {
    const records = [...unsorted].sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));
    entries.push({
      name,
      totalSetsLogged: records.length,
      firstLoggedDate: records[0]!.scheduledDate,
      lastLoggedDate: records[records.length - 1]!.scheduledDate,
      records,
      bestWeight: bestNumeric(
        records,
        (r) => r.weight,
        (r) => r.weightUnit ?? '',
        'max',
      ),
      bestReps: bestNumeric(
        records,
        (r) => r.reps,
        () => 'reps',
        'max',
      ),
      bestDistance: bestNumeric(
        records,
        (r) => r.distance,
        (r) => r.distanceUnit ?? '',
        'max',
      ),
      bestHoldSeconds: bestNumeric(
        records,
        (r) => r.timeSeconds,
        () => 's',
        'max',
      ),
      bestSprintTime: bestNumeric(
        records,
        (r) => r.sprintTime,
        () => 's',
        'min',
      ),
      volumeBySession: computeVolumeBySession(records),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
