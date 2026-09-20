/**
 * Deterministic seed/import mechanism.
 *
 * Expands the validated program_content JSON into the row shapes described
 * in docs/phase1/DATABASE_SCHEMA.md (program_weeks / program_days /
 * workout_templates / exercise_templates / workout_exercises /
 * prescribed_sets / am_week_overlays / testing_marker_defs / substitutions),
 * ready for a Supabase upsert or for the local demo-mode content store.
 *
 * "Deterministic" here means: given the same program_content and the same
 * program_version_id, this always produces the same ids (uuid v5, keyed by
 * a stable natural-key string) — so re-running the importer against the
 * same source is idempotent and safe to use with `ON CONFLICT (id) DO
 * UPDATE`, per DATABASE_SCHEMA.md's offline-sync/idempotency principles.
 *
 * This module performs *expansion*, not interpretation: every value it
 * writes is copied verbatim from the source JSON. Nothing here invents
 * prescriptions, rounds numbers, or fills gaps — see docs/phase1/
 * EXTRACTION_AUDIT.md for the (already-resolved) judgment calls baked into
 * the source JSON itself.
 */
import type { ProgramContent } from '../schema';
import type { StrengthDayLetter } from '../repository';
import { deterministicId as id, programVersionIdForSlug } from './deterministicId';

export { programVersionIdForSlug };

export interface SeedProgramVersion {
  id: string;
  slug: string;
  title: string;
  edition: string;
  duration_weeks: number;
  source_document: string | null;
  content_json: ProgramContent;
  is_published: true;
}

export interface SeedProgramWeek {
  id: string;
  program_version_id: string;
  week_number: number;
  block: 'absorb' | 'build' | 'express' | null;
  is_deload: boolean;
  is_retest: boolean;
  is_taper_and_test: boolean;
  narrative: string | null;
  loading_pct_low: number | null;
  loading_pct_high: number | null;
  loading_rir_label: string | null;
}

export interface SeedProgramDay {
  id: string;
  program_week_id: string;
  day_of_week: number; // 0=Mon..6=Sun
  label: string;
}

export interface SeedExerciseTemplate {
  id: string;
  program_version_id: string;
  name: string;
  quality_cap: boolean;
  bilateral: boolean;
}

export interface SeedWorkoutTemplate {
  id: string;
  program_day_id: string;
  session_slot: 'am' | 'pm';
  session_type: string;
  title: string;
  main_lift: string | null;
  est_minutes_low: number | null;
  est_minutes_high: number | null;
  is_contrast: boolean;
}

export interface SeedWorkoutExercise {
  id: string;
  workout_template_id: string;
  exercise_template_id: string;
  cluster_id: string;
  cluster_label: string | null;
  slot_order: string;
  rounds: number;
  rest_label: string | null;
  each_side: boolean;
  is_combo: boolean;
  notes: string | null;
  sort_index: number;
}

export interface SeedPrescribedSet {
  id: string;
  workout_exercise_id: string;
  week_number: number;
  load_type: 'percentage' | 'rir' | 'quality_cap' | 'bodyweight' | 'none';
  load_value: number | null;
  reps_display: string;
}

export interface SeedAmWeekOverlay {
  id: string;
  program_version_id: string;
  week_number: number;
  mon_am_detail: string;
  thu_am_detail: string;
  sat_am_minutes: number;
  sprint_volume_yd: number | null;
  sprint_volume_note: string | null;
  note: string | null;
  is_deload: boolean;
  is_retest: boolean;
  is_test_week: boolean;
}

export interface SeedTestingMarkerDef {
  id: string;
  program_version_id: string;
  marker_number: number;
  layer: 'longevity_ten' | 'athletic_five';
  name: string;
  protocol: string;
  unit: string;
  direction: string;
  baseline_value: string | null;
  solid_value: string | null;
  strong_value: string | null;
  bilateral: boolean;
  attempts: number | null;
  formula: string | null;
  caution_note: string | null;
}

export interface SeedSubstitution {
  id: string;
  program_version_id: string;
  missing_equipment_or_situation: string;
  use_instead: string;
  is_safety_rule: boolean;
}

export interface ExpandedProgram {
  programVersion: SeedProgramVersion;
  weeks: SeedProgramWeek[];
  days: SeedProgramDay[];
  exerciseTemplates: SeedExerciseTemplate[];
  workoutTemplates: SeedWorkoutTemplate[];
  workoutExercises: SeedWorkoutExercise[];
  prescribedSets: SeedPrescribedSet[];
  amWeekOverlays: SeedAmWeekOverlay[];
  testingMarkerDefs: SeedTestingMarkerDef[];
  substitutions: SeedSubstitution[];
}

const BLOCK_NAME_BY_ID: Record<number, 'absorb' | 'build' | 'express'> = {
  1: 'absorb',
  2: 'build',
  3: 'express',
};

const STRENGTH_DAY_MAP: Record<StrengthDayLetter, { dayOfWeek: number; sessionType: string }> = {
  A: { dayOfWeek: 0, sessionType: 'pm_strength_a' }, // Monday
  B: { dayOfWeek: 1, sessionType: 'pm_strength_b' }, // Tuesday
  C: { dayOfWeek: 3, sessionType: 'pm_strength_c' }, // Thursday
  D: { dayOfWeek: 5, sessionType: 'pm_strength_d' }, // Saturday
};

/**
 * AM sessions, by weekly-template day-of-week (0=Mon..6=Sun). Monday,
 * Thursday, and Saturday AM are prose-described blocks in the source PDF
 * (warm-up/plyo/acceleration/easy-run text, not a sets/reps grid), so they
 * only get a `workout_templates` row here — enough to satisfy
 * `workout_sessions.workout_template_id`'s FK — with no `workout_exercises`
 * underneath (Phase 3 logs those sessions at the session/journal level, see
 * src/features/workout/sessionPlanBuilder.ts). Tuesday's Core/Balance/Brake
 * circuit *does* have a clean per-movement structure in the source JSON
 * (`tuesdayAmCoreBalanceBrake.movements[]`), so it gets full
 * `workout_exercises` + `prescribed_sets` rows, same as PM strength.
 */
const AM_DAY_MAP: Record<
  number,
  { sessionType: string; ref: 'mondaySpeedPlyo' | 'tuesdayCoreBalanceBrake' | 'thu' | 'sat' }
> = {
  0: { sessionType: 'am_speed_plyo', ref: 'mondaySpeedPlyo' },
  1: { sessionType: 'am_core_balance_brake', ref: 'tuesdayCoreBalanceBrake' },
  3: { sessionType: 'am_tempo_agility', ref: 'thu' },
  5: { sessionType: 'am_long_run', ref: 'sat' },
};

function loadTypeFor(type: 'pct' | 'rir' | 'none'): SeedPrescribedSet['load_type'] {
  if (type === 'pct') return 'percentage';
  if (type === 'rir') return 'rir';
  return 'bodyweight';
}

/**
 * Expands validated program content into DB-row-shaped seed data for a
 * given program_version_id (pass a stable uuid — the caller decides whether
 * that's a freshly generated id for a first import or the existing row's id
 * for a re-import of the same version).
 */
export function expandProgramContent(
  content: ProgramContent,
  programVersionId: string,
): ExpandedProgram {
  const exerciseTemplateIdByName = new Map<string, string>();
  function exerciseTemplateId(name: string): string {
    const existing = exerciseTemplateIdByName.get(name);
    if (existing) return existing;
    const newId = id('exercise_template', programVersionId, name);
    exerciseTemplateIdByName.set(name, newId);
    return newId;
  }

  const exerciseTemplates: SeedExerciseTemplate[] = [];
  const weeks: SeedProgramWeek[] = [];
  const days: SeedProgramDay[] = [];
  const workoutTemplates: SeedWorkoutTemplate[] = [];
  const workoutExercises: SeedWorkoutExercise[] = [];
  const prescribedSets: SeedPrescribedSet[] = [];

  // program_weeks (0-12) + program_days (0-6 per week)
  const weekIdByNumber = new Map<number, string>();
  const dayIdByWeekAndDow = new Map<string, string>();

  for (let weekNumber = 0; weekNumber <= content.meta.durationWeeks; weekNumber += 1) {
    const block = content.blocks.find((b) => b.weeks.includes(weekNumber)) ?? null;
    const weekId = id('program_week', programVersionId, weekNumber);
    weekIdByNumber.set(weekNumber, weekId);

    weeks.push({
      id: weekId,
      program_version_id: programVersionId,
      week_number: weekNumber,
      block: block ? (BLOCK_NAME_BY_ID[block.id] ?? null) : null,
      is_deload: block?.deloadWeek === weekNumber,
      is_retest: block?.retestWeek === weekNumber,
      is_taper_and_test: block?.taperAndTestWeek === weekNumber,
      narrative: block?.narrative ?? null,
      loading_pct_low: block?.loading.pctRange[0] ?? null,
      loading_pct_high: block?.loading.pctRange[1] ?? null,
      loading_rir_label: block?.loading.rir ?? null,
    });

    for (const templateDay of content.weeklyTemplate) {
      const dayOfWeek = content.weeklyTemplate.indexOf(templateDay);
      const dayId = id('program_day', weekId, dayOfWeek);
      dayIdByWeekAndDow.set(`${weekNumber}:${dayOfWeek}`, dayId);
      days.push({
        id: dayId,
        program_week_id: weekId,
        day_of_week: dayOfWeek,
        label: templateDay.day,
      });
    }
  }

  // Strength A/B/C/D workout_templates + workout_exercises + prescribed_sets
  for (const letter of Object.keys(STRENGTH_DAY_MAP) as StrengthDayLetter[]) {
    const { dayOfWeek, sessionType } = STRENGTH_DAY_MAP[letter];
    const byBlock = content.strengthDays[letter];

    for (const blockKey of Object.keys(byBlock)) {
      const dayBlock = byBlock[blockKey];
      if (!dayBlock) continue;

      for (const [inBlockIndex, weekNumber] of dayBlock.weeks.entries()) {
        const dayId = dayIdByWeekAndDow.get(`${weekNumber}:${dayOfWeek}`);
        if (!dayId) continue;

        const workoutTemplateId = id('workout_template', dayId, 'pm');
        workoutTemplates.push({
          id: workoutTemplateId,
          program_day_id: dayId,
          session_slot: 'pm',
          session_type: sessionType,
          title: `STRENGTH ${letter} — ${dayBlock.focus}`,
          main_lift: dayBlock.mainLift,
          est_minutes_low: 40,
          est_minutes_high: 45,
          is_contrast: dayBlock.clusters.some((c) => c.contrast),
        });

        let sortIndex = 0;
        for (const cluster of dayBlock.clusters) {
          for (const exercise of cluster.exercises) {
            const exTemplateId = exerciseTemplateId(exercise.name);
            if (!exerciseTemplates.some((e) => e.id === exTemplateId)) {
              exerciseTemplates.push({
                id: exTemplateId,
                program_version_id: programVersionId,
                name: exercise.name,
                quality_cap: cluster.qualityCap,
                bilateral: exercise.eachSide ?? false,
              });
            }

            const workoutExerciseId = id('workout_exercise', workoutTemplateId, exercise.order);
            workoutExercises.push({
              id: workoutExerciseId,
              workout_template_id: workoutTemplateId,
              exercise_template_id: exTemplateId,
              cluster_id: cluster.id,
              cluster_label: cluster.label,
              slot_order: exercise.order,
              rounds: cluster.rounds,
              rest_label: exercise.rest,
              each_side: exercise.eachSide ?? false,
              is_combo: exercise.comboExercise ?? false,
              notes: exercise.notes ?? null,
              sort_index: sortIndex,
            });
            sortIndex += 1;

            const prescription = exercise.weeks[inBlockIndex];
            if (prescription) {
              prescribedSets.push({
                id: id('prescribed_set', workoutExerciseId, weekNumber),
                workout_exercise_id: workoutExerciseId,
                week_number: weekNumber,
                load_type: loadTypeFor(prescription.load.type),
                load_value: prescription.load.value ?? null,
                reps_display: prescription.reps,
              });
            }
          }
        }
      }
    }
  }

  // AM workout_templates (weeks 1-12 only — Week 0 is baseline testing, not
  // a training week; see src/features/schedule for how the app treats it).
  // Tuesday additionally gets workout_exercises + prescribed_sets from its
  // structured movements[] list.
  const blockByWeek = new Map<number, (typeof content.blocks)[number] | null>();
  for (let weekNumber = 1; weekNumber <= content.meta.durationWeeks; weekNumber += 1) {
    blockByWeek.set(weekNumber, content.blocks.find((b) => b.weeks.includes(weekNumber)) ?? null);
  }

  for (let weekNumber = 1; weekNumber <= content.meta.durationWeeks; weekNumber += 1) {
    const block = blockByWeek.get(weekNumber) ?? null;
    if (!block) continue;

    for (const dayOfWeekStr of Object.keys(AM_DAY_MAP)) {
      const dayOfWeek = Number(dayOfWeekStr);
      const { sessionType, ref } = AM_DAY_MAP[dayOfWeek]!;
      const dayId = dayIdByWeekAndDow.get(`${weekNumber}:${dayOfWeek}`);
      if (!dayId) continue;

      const templateDay = content.weeklyTemplate[dayOfWeek]!;
      const workoutTemplateId = id('workout_template', dayId, 'am');
      workoutTemplates.push({
        id: workoutTemplateId,
        program_day_id: dayId,
        session_slot: 'am',
        session_type: sessionType,
        title: templateDay.am.label,
        main_lift: null,
        est_minutes_low: templateDay.am.minutes?.[0] ?? null,
        est_minutes_high: templateDay.am.minutes?.[1] ?? null,
        is_contrast: false,
      });

      if (ref !== 'tuesdayCoreBalanceBrake') continue;

      let sortIndex = 0;
      for (const movement of content.tuesdayAmCoreBalanceBrake.movements) {
        const exTemplateId = exerciseTemplateId(movement.name);
        if (!exerciseTemplates.some((e) => e.id === exTemplateId)) {
          exerciseTemplates.push({
            id: exTemplateId,
            program_version_id: programVersionId,
            name: movement.name,
            quality_cap: false,
            bilateral: movement.eachSide ?? false,
          });
        }

        const workoutExerciseId = id('workout_exercise', workoutTemplateId, movement.order);
        // Only emit the exercise + its prescribed_sets row once per program
        // day (weeks share the same movements[]; the block-specific reps
        // text is what varies week to week, captured below).
        if (!workoutExercises.some((e) => e.id === workoutExerciseId)) {
          workoutExercises.push({
            id: workoutExerciseId,
            workout_template_id: workoutTemplateId,
            exercise_template_id: exTemplateId,
            cluster_id: movement.order.charAt(0),
            cluster_label: null,
            slot_order: movement.order,
            rounds: 1,
            rest_label: null,
            each_side: movement.eachSide ?? false,
            is_combo: false,
            notes: null,
            sort_index: sortIndex,
          });
        }
        sortIndex += 1;

        const repsDisplay = movement.byBlock[String(block.id)];
        if (repsDisplay) {
          prescribedSets.push({
            id: id('prescribed_set', workoutExerciseId, weekNumber),
            workout_exercise_id: workoutExerciseId,
            week_number: weekNumber,
            load_type: 'bodyweight',
            load_value: null,
            reps_display: repsDisplay,
          });
        }
      }
    }
  }

  // am_week_overlays from weeklySpeedPlan
  const amWeekOverlays: SeedAmWeekOverlay[] = content.weeklySpeedPlan.map((entry) => ({
    id: id('am_week_overlay', programVersionId, entry.week),
    program_version_id: programVersionId,
    week_number: entry.week,
    mon_am_detail: entry.monAm,
    thu_am_detail: entry.thuAm,
    sat_am_minutes: entry.satAmMinutes,
    sprint_volume_yd: entry.sprintVolumeYd,
    sprint_volume_note: entry.sprintVolumeNote ?? null,
    note: entry.note ?? null,
    is_deload: entry.deload ?? false,
    is_retest: entry.retest ?? false,
    is_test_week: entry.testWeek ?? false,
  }));

  // testing_marker_defs
  const testingMarkerDefs: SeedTestingMarkerDef[] = [
    ...content.testing.longevityTen.map((m) => ({ ...m, layer: 'longevity_ten' as const })),
    ...content.testing.athleticFive.map((m) => ({ ...m, layer: 'athletic_five' as const })),
  ].map((m) => ({
    id: id('testing_marker_def', programVersionId, m.num),
    program_version_id: programVersionId,
    marker_number: m.num,
    layer: m.layer,
    name: m.name,
    protocol: m.protocol,
    unit: m.unit,
    direction: m.direction,
    baseline_value: m.baseline !== undefined ? String(m.baseline) : null,
    solid_value: m.solid !== undefined ? String(m.solid) : null,
    strong_value: m.strong !== undefined ? String(m.strong) : null,
    bilateral: m.bilateral ?? false,
    attempts: m.attempts ?? null,
    formula: m.formula ?? null,
    caution_note: m.caution ?? null,
  }));

  // substitutions
  const substitutions: SeedSubstitution[] = content.substitutions.map((s) => ({
    id: id('substitution', programVersionId, s.missing),
    program_version_id: programVersionId,
    missing_equipment_or_situation: s.missing,
    use_instead: s.useInstead,
    is_safety_rule: s.isSafetyRule ?? false,
  }));

  const programVersion: SeedProgramVersion = {
    id: programVersionId,
    slug: content.meta.id,
    title: content.meta.title,
    edition: content.meta.edition,
    duration_weeks: content.meta.durationWeeks,
    source_document: content.meta.sourceDocument ?? null,
    content_json: content,
    is_published: true,
  };

  return {
    programVersion,
    weeks,
    days,
    exerciseTemplates,
    workoutTemplates,
    workoutExercises,
    prescribedSets,
    amWeekOverlays,
    testingMarkerDefs,
    substitutions,
  };
}
