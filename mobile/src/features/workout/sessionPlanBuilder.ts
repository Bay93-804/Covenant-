/**
 * Turns a scheduled day + slot + any confirmed readiness/pickup-sport
 * adjustments into a concrete plan for the Guided Workout Player.
 *
 * PM strength days and Tuesday's Core/Balance/Brake circuit have a genuine
 * per-exercise sets/reps structure in the source PDF, so they become
 * `exercises[]` with per-set logging support (a real `workoutExerciseId`
 * from src/content/contentIds.ts, usable in `completed_sets`). Monday
 * Speed/Plyo, Thursday Tempo/Agility, and Saturday's long run are
 * prose-described blocks in the PDF — this builder renders them as an
 * ordered `segments[]` checklist instead of inventing a sets/reps table
 * that isn't in the source material; those get logged at the
 * session/journal level (see workoutRepository.ts).
 */
import {
  strengthWorkoutExerciseId,
  tuesdayCoreBalanceBrakeExerciseId,
} from '../../content/contentIds';
import {
  getProgramContent,
  getStrengthDayForWeek,
  getWeeklySpeedPlanForWeek,
  type StrengthDayLetter,
} from '../../content/repository';
import type { ClusterExercise, ExerciseWeekPrescription } from '../../content/schema';
import {
  applyAdjustmentsToSpeedSession,
  applyAdjustmentsToStrengthDay,
  type SessionAdjustmentFlags,
} from '../readiness/readinessRules';
import type { ScheduledDay, ScheduleSessionType } from '../schedule/scheduleEngine';

export interface PlayerSetTarget {
  setNumber: number;
  side: 'left' | 'right' | 'both' | null;
  targetRepsDisplay: string;
  load: { type: 'pct' | 'rir' | 'none'; value?: number };
}

export interface PlayerExercise {
  workoutExerciseId: string;
  key: string;
  order: string;
  name: string;
  clusterId: string | null;
  clusterLabel: string | null;
  restLabel: string | null;
  eachSide: boolean;
  isCombo: boolean;
  notes: string | null;
  qualityCap: boolean;
  sets: PlayerSetTarget[];
}

export interface PlayerSegment {
  key: string;
  label: string;
  detail: string;
  blocked: boolean;
  blockedReason: string | null;
}

export interface PlayerSessionPlan {
  sessionType: ScheduleSessionType;
  slot: 'am' | 'pm';
  title: string;
  weekNumber: number;
  strengthLetter: StrengthDayLetter | null;
  /** The resolved day's authoritative `mainLift` field (e.g. "Trap-Bar Deadlift"), or null when the day has none (e.g. Strength D, or any AM session) — the single source the load calculator classifies against, never a hard-coded per-letter lookup. */
  mainLift: string | null;
  supportsPerSetLogging: boolean;
  exercises: PlayerExercise[];
  segments: PlayerSegment[];
  adjustmentSummary: string[];
  estMinutesLow: number | null;
  estMinutesHigh: number | null;
}

/** Tuesday's `structure` text ("Three rounds of A, two rounds of B") is stable for this program version — see tuesdayAmCoreBalanceBrake.structure. */
const TUESDAY_ROUNDS_BY_GROUP: Record<string, number> = { A: 3, B: 2 };

function buildSets(
  rounds: number,
  prescription: ExerciseWeekPrescription,
  eachSide: boolean,
): PlayerSetTarget[] {
  const sets: PlayerSetTarget[] = [];
  for (let setNumber = 1; setNumber <= rounds; setNumber++) {
    if (eachSide) {
      sets.push({
        setNumber,
        side: 'left',
        targetRepsDisplay: prescription.reps,
        load: prescription.load,
      });
      sets.push({
        setNumber,
        side: 'right',
        targetRepsDisplay: prescription.reps,
        load: prescription.load,
      });
    } else {
      sets.push({
        setNumber,
        side: null,
        targetRepsDisplay: prescription.reps,
        load: prescription.load,
      });
    }
  }
  return sets;
}

function buildStrengthPlan(
  letter: StrengthDayLetter,
  weekNumber: number,
  flags: SessionAdjustmentFlags | undefined,
): { exercises: PlayerExercise[]; adjustmentSummary: string[]; mainLift: string | null } {
  const resolved = getStrengthDayForWeek(letter, weekNumber);
  if (!resolved) return { exercises: [], adjustmentSummary: [], mainLift: null };

  const adjusted = flags
    ? applyAdjustmentsToStrengthDay(resolved.dayBlock, flags)
    : {
        clusters: resolved.dayBlock.clusters,
        removedClusterIds: [],
        rirOverrideApplied: null,
        usedDeloadLoading: false,
      };

  const exercises: PlayerExercise[] = [];
  for (const cluster of adjusted.clusters) {
    for (const exercise of cluster.exercises as ClusterExercise[]) {
      const prescription = exercise.weeks[resolved.context.inBlockIndex ?? 0];
      if (!prescription) continue;
      const effectivePrescription: ExerciseWeekPrescription =
        adjusted.rirOverrideApplied != null && prescription.load.type === 'rir'
          ? { ...prescription, load: { type: 'rir', value: adjusted.rirOverrideApplied } }
          : prescription;

      exercises.push({
        workoutExerciseId: strengthWorkoutExerciseId(letter, weekNumber, exercise.order),
        key: `${cluster.id}-${exercise.order}`,
        order: exercise.order,
        name: exercise.name,
        clusterId: cluster.id,
        clusterLabel: cluster.label,
        restLabel: exercise.rest,
        eachSide: exercise.eachSide ?? false,
        isCombo: exercise.comboExercise ?? false,
        notes: exercise.notes ?? null,
        qualityCap: cluster.qualityCap,
        sets: buildSets(cluster.rounds, effectivePrescription, exercise.eachSide ?? false),
      });
    }
  }

  const adjustmentSummary: string[] = [];
  if (adjusted.removedClusterIds.length > 0) {
    adjustmentSummary.push(`Cluster ${adjusted.removedClusterIds.join(', ')} removed for today.`);
  }
  if (adjusted.rirOverrideApplied != null) {
    adjustmentSummary.push(`RIR target overridden to ${adjusted.rirOverrideApplied} for today.`);
  }
  if (adjusted.usedDeloadLoading) {
    adjustmentSummary.push('Using deload-week loading today.');
  }

  return { exercises, adjustmentSummary, mainLift: resolved.dayBlock.mainLift };
}

function buildTuesdayPlan(weekNumber: number): PlayerExercise[] {
  const content = getProgramContent();
  const block = content.blocks.find((b) => b.weeks.includes(weekNumber));
  if (!block) return [];

  return content.tuesdayAmCoreBalanceBrake.movements.map((movement) => {
    const group = movement.order.charAt(0);
    const rounds = TUESDAY_ROUNDS_BY_GROUP[group] ?? 1;
    const repsDisplay = movement.byBlock[String(block.id)] ?? '';
    const prescription: ExerciseWeekPrescription = { load: { type: 'none' }, reps: repsDisplay };
    return {
      workoutExerciseId: tuesdayCoreBalanceBrakeExerciseId(weekNumber, movement.order),
      key: movement.order,
      order: movement.order,
      name: movement.name,
      clusterId: group,
      clusterLabel: null,
      restLabel: null,
      eachSide: movement.eachSide ?? false,
      isCombo: false,
      notes: movement.coachingKey,
      qualityCap: false,
      sets: buildSets(rounds, prescription, movement.eachSide ?? false),
    };
  });
}

function buildMondaySegments(
  weekNumber: number,
  flags: SessionAdjustmentFlags | undefined,
): PlayerSegment[] {
  const content = getProgramContent();
  const block = content.blocks.find((b) => b.weeks.includes(weekNumber));
  const byBlock = block ? content.mondayAmSpeedPlyo.byBlock[String(block.id)] : undefined;
  const speedPlan = getWeeklySpeedPlanForWeek(weekNumber);
  if (!byBlock || !speedPlan) return [];

  const adjusted = flags ? applyAdjustmentsToSpeedSession(speedPlan, flags) : null;

  const segments: PlayerSegment[] = [
    {
      key: 'overlay',
      label: 'This week',
      detail: speedPlan.monAm,
      blocked: false,
      blockedReason: null,
    },
    {
      key: 'warmup',
      label: 'Warm-up',
      detail: byBlock.warmup,
      blocked: false,
      blockedReason: null,
    },
    {
      key: 'plyometric',
      label: 'Plyometrics',
      detail: byBlock.plyometric,
      blocked: Boolean(adjusted?.plyometricsBlocked),
      blockedReason: adjusted?.plyometricsBlocked
        ? 'Plyometrics removed for today — see safety adjustment.'
        : null,
    },
    {
      key: 'acceleration',
      label: 'Acceleration / sprint work',
      detail: byBlock.acceleration,
      blocked: Boolean(adjusted?.sprintBlocked),
      blockedReason: adjusted?.sprintBlocked
        ? 'Sprint work removed for today — see safety adjustment.'
        : null,
    },
    {
      key: 'easyRun',
      label: 'Easy run',
      detail: byBlock.easyRun,
      blocked: false,
      blockedReason: null,
    },
    {
      key: 'flow',
      label: 'Mobility flow',
      detail: byBlock.flow,
      blocked: false,
      blockedReason: null,
    },
  ];
  if (speedPlan.note) {
    segments.push({
      key: 'note',
      label: 'Note',
      detail: speedPlan.note,
      blocked: false,
      blockedReason: null,
    });
  }
  return segments;
}

function buildThursdaySegments(
  weekNumber: number,
  flags: SessionAdjustmentFlags | undefined,
): PlayerSegment[] {
  const speedPlan = getWeeklySpeedPlanForWeek(weekNumber);
  if (!speedPlan) return [];
  const adjusted = flags ? applyAdjustmentsToSpeedSession(speedPlan, flags) : null;

  const segments: PlayerSegment[] = [
    {
      key: 'overlay',
      label: 'Tempo / repeat-sprint + agility',
      detail: speedPlan.thuAm,
      blocked: Boolean(adjusted?.sprintBlocked),
      blockedReason: adjusted?.sprintBlocked
        ? 'Sprint portion removed for today — proceed at an easy conversational pace instead.'
        : null,
    },
  ];
  if (speedPlan.note) {
    segments.push({
      key: 'note',
      label: 'Note',
      detail: speedPlan.note,
      blocked: false,
      blockedReason: null,
    });
  }
  return segments;
}

function buildSaturdaySegments(weekNumber: number): PlayerSegment[] {
  const content = getProgramContent();
  const block = content.blocks.find((b) => b.weeks.includes(weekNumber));
  const speedPlan = getWeeklySpeedPlanForWeek(weekNumber);
  if (!speedPlan) return [];

  const segments: PlayerSegment[] = [
    {
      key: 'run',
      label: 'Long easy run',
      detail: `${speedPlan.satAmMinutes} minutes, conversational pace.`,
      blocked: false,
      blockedReason: null,
    },
  ];
  for (const movement of content.mobilityFlow.movements) {
    segments.push({
      key: `flow-${movement.name}`,
      label: movement.name,
      detail: block ? (movement.byBlock[String(block.id)] ?? '') : '',
      blocked: false,
      blockedReason: null,
    });
  }
  return segments;
}

export interface BuildSessionPlanParams {
  scheduledDay: ScheduledDay;
  slot: 'am' | 'pm';
  readinessAdjustments?: SessionAdjustmentFlags;
}

export function buildSessionPlayerPlan(params: BuildSessionPlanParams): PlayerSessionPlan {
  const { scheduledDay, slot, readinessAdjustments } = params;
  const session = slot === 'am' ? scheduledDay.am : scheduledDay.pm;
  const weekNumber = scheduledDay.weekNumber;

  const base: PlayerSessionPlan = {
    sessionType: session.sessionType,
    slot,
    title: session.title,
    weekNumber,
    strengthLetter: session.strengthLetter,
    mainLift: null,
    supportsPerSetLogging: false,
    exercises: [],
    segments: [],
    adjustmentSummary: [],
    estMinutesLow: session.minutesLow,
    estMinutesHigh: session.minutesHigh,
  };

  if (slot === 'pm' && session.strengthLetter) {
    const { exercises, adjustmentSummary, mainLift } = buildStrengthPlan(
      session.strengthLetter,
      weekNumber,
      readinessAdjustments,
    );
    return { ...base, supportsPerSetLogging: true, exercises, adjustmentSummary, mainLift };
  }

  switch (session.sessionType) {
    case 'am_core_balance_brake':
      return { ...base, supportsPerSetLogging: true, exercises: buildTuesdayPlan(weekNumber) };
    case 'am_speed_plyo':
      return { ...base, segments: buildMondaySegments(weekNumber, readinessAdjustments) };
    case 'am_tempo_agility':
      return { ...base, segments: buildThursdaySegments(weekNumber, readinessAdjustments) };
    case 'am_long_run':
      return { ...base, segments: buildSaturdaySegments(weekNumber) };
    default:
      return base;
  }
}
