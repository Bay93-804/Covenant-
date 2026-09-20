/**
 * Hand-written Supabase database types, mirroring
 * docs/phase1/DATABASE_SCHEMA.md and supabase/migrations/*.sql exactly.
 *
 * There is no live Supabase project to run `supabase gen types` against in
 * this phase, so these are authored directly from the approved DDL. When a
 * real project exists, regenerate this file with the Supabase CLI and diff
 * it against this one — the shapes should match.
 */

export type BlockName = 'absorb' | 'build' | 'express';
export type SessionSlot = 'am' | 'pm';
export type SessionType =
  | 'am_speed_plyo'
  | 'am_core_balance_brake'
  | 'am_tempo_agility'
  | 'am_long_run'
  | 'am_rest'
  | 'pm_strength_a'
  | 'pm_strength_b'
  | 'pm_strength_c'
  | 'pm_strength_d'
  | 'pm_rest';
export type LoadType =
  'percentage' | 'rir' | 'quality_cap' | 'bodyweight' | 'time' | 'distance' | 'none';
export type WorkoutStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'adjusted';
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'restarted' | 'abandoned';
export type TestingEventKey = 'week0' | 'week6' | 'week12' | 'ad_hoc';
export type MarkerLayer = 'longevity_ten' | 'athletic_five';
export type JournalLevel = 'set' | 'exercise' | 'workout' | 'day';
export type SafetyTriggerCode =
  | 'RHR_ELEVATED'
  | 'CALF_ACHILLES_WARNING'
  | 'SLEEP_UNDER_6H'
  | 'HAMSTRING_GRABBY'
  | 'JOINT_PAIN_MOVEMENT_CHANGE'
  | 'TWO_MISSED_WEEKS';
export type ProfileRole = 'athlete' | 'coach';
export type UnitsWeight = 'lb' | 'kg';
export type UnitsDistance = 'mi' | 'km';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  role: ProfileRole;
  date_of_birth: string | null;
  timezone: string;
  units_weight: UnitsWeight;
  units_distance: UnitsDistance;
  bodyweight_lb: number | null;
  created_at: string;
  updated_at: string;
};
export type ProfileInsert = Partial<Omit<ProfileRow, 'id'>> & { id: string };
export type ProfileUpdate = Partial<ProfileRow>;

export type ProgramVersionRow = {
  id: string;
  slug: string;
  title: string;
  edition: string;
  duration_weeks: number;
  source_document: string | null;
  content_json: unknown;
  is_published: boolean;
  created_at: string;
};
export type ProgramVersionInsert = Partial<ProgramVersionRow> &
  Pick<ProgramVersionRow, 'slug' | 'title' | 'edition' | 'content_json'>;
export type ProgramVersionUpdate = Partial<ProgramVersionRow>;

export type ProgramWeekRow = {
  id: string;
  program_version_id: string;
  week_number: number;
  block: BlockName | null;
  is_deload: boolean;
  is_retest: boolean;
  is_taper_and_test: boolean;
  narrative: string | null;
  loading_pct_low: number | null;
  loading_pct_high: number | null;
  loading_rir_label: string | null;
};
export type ProgramWeekInsert = Partial<ProgramWeekRow> &
  Pick<ProgramWeekRow, 'program_version_id' | 'week_number'>;
export type ProgramWeekUpdate = Partial<ProgramWeekRow>;

export type ProgramDayRow = {
  id: string;
  program_week_id: string;
  day_of_week: number;
  label: string;
};
export type ProgramDayInsert = Partial<ProgramDayRow> &
  Pick<ProgramDayRow, 'program_week_id' | 'day_of_week' | 'label'>;
export type ProgramDayUpdate = Partial<ProgramDayRow>;

export type ExerciseTemplateRow = {
  id: string;
  program_version_id: string;
  name: string;
  movement_category: string | null;
  is_power_movement: boolean;
  quality_cap: boolean;
  coaching_cue: string | null;
  default_unit: string | null;
  bilateral: boolean;
  created_at: string;
};
export type ExerciseTemplateInsert = Partial<ExerciseTemplateRow> &
  Pick<ExerciseTemplateRow, 'program_version_id' | 'name'>;
export type ExerciseTemplateUpdate = Partial<ExerciseTemplateRow>;

export type SubstitutionRow = {
  id: string;
  program_version_id: string;
  missing_equipment_or_situation: string;
  use_instead: string;
  exercise_template_id: string | null;
  is_safety_rule: boolean;
};
export type SubstitutionInsert = Partial<SubstitutionRow> &
  Pick<SubstitutionRow, 'program_version_id' | 'missing_equipment_or_situation' | 'use_instead'>;
export type SubstitutionUpdate = Partial<SubstitutionRow>;

export type WorkoutTemplateRow = {
  id: string;
  program_day_id: string;
  session_slot: SessionSlot;
  session_type: SessionType;
  title: string;
  main_lift: string | null;
  est_minutes_low: number | null;
  est_minutes_high: number | null;
  is_contrast: boolean;
};
export type WorkoutTemplateInsert = Partial<WorkoutTemplateRow> &
  Pick<WorkoutTemplateRow, 'program_day_id' | 'session_slot' | 'session_type' | 'title'>;
export type WorkoutTemplateUpdate = Partial<WorkoutTemplateRow>;

export type WorkoutExerciseRow = {
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
};
export type WorkoutExerciseInsert = Partial<WorkoutExerciseRow> &
  Pick<
    WorkoutExerciseRow,
    | 'workout_template_id'
    | 'exercise_template_id'
    | 'cluster_id'
    | 'slot_order'
    | 'rounds'
    | 'sort_index'
  >;
export type WorkoutExerciseUpdate = Partial<WorkoutExerciseRow>;

export type PrescribedSetRow = {
  id: string;
  workout_exercise_id: string;
  week_number: number;
  load_type: LoadType;
  load_value: number | null;
  reps_display: string;
};
export type PrescribedSetInsert = Partial<PrescribedSetRow> &
  Pick<PrescribedSetRow, 'workout_exercise_id' | 'week_number' | 'load_type' | 'reps_display'>;
export type PrescribedSetUpdate = Partial<PrescribedSetRow>;

export type AmWeekOverlayRow = {
  id: string;
  program_version_id: string;
  week_number: number;
  mon_am_detail: string | null;
  thu_am_detail: string | null;
  sat_am_minutes: number | null;
  sprint_volume_yd: number | null;
  sprint_volume_note: string | null;
  note: string | null;
  is_deload: boolean;
  is_retest: boolean;
  is_test_week: boolean;
};
export type AmWeekOverlayInsert = Partial<AmWeekOverlayRow> &
  Pick<AmWeekOverlayRow, 'program_version_id' | 'week_number'>;
export type AmWeekOverlayUpdate = Partial<AmWeekOverlayRow>;

export type TestingMarkerDefRow = {
  id: string;
  program_version_id: string;
  marker_number: number;
  layer: MarkerLayer;
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
};
export type TestingMarkerDefInsert = Partial<TestingMarkerDefRow> &
  Pick<
    TestingMarkerDefRow,
    'program_version_id' | 'marker_number' | 'layer' | 'name' | 'protocol' | 'unit' | 'direction'
  >;
export type TestingMarkerDefUpdate = Partial<TestingMarkerDefRow>;

export type ProgramEnrollmentRow = {
  id: string;
  user_id: string;
  program_version_id: string;
  coach_id: string | null;
  start_date: string;
  status: EnrollmentStatus;
  current_week_override: number | null;
  paused_at: string | null;
  restarted_from_enrollment_id: string | null;
  created_at: string;
  updated_at: string;
};
export type ProgramEnrollmentInsert = Partial<ProgramEnrollmentRow> &
  Pick<ProgramEnrollmentRow, 'user_id' | 'program_version_id' | 'start_date'>;
export type ProgramEnrollmentUpdate = Partial<ProgramEnrollmentRow>;

export type WorkoutSessionRow = {
  id: string;
  client_uuid: string;
  enrollment_id: string;
  user_id: string;
  program_day_id: string;
  workout_template_id: string;
  scheduled_date: string;
  session_slot: SessionSlot;
  status: WorkoutStatus;
  readiness_entry_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_actual_seconds: number | null;
  completion_pct: number | null;
  abandoned: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
};
export type WorkoutSessionInsert = Partial<WorkoutSessionRow> &
  Pick<
    WorkoutSessionRow,
    | 'enrollment_id'
    | 'user_id'
    | 'program_day_id'
    | 'workout_template_id'
    | 'scheduled_date'
    | 'session_slot'
  >;
export type WorkoutSessionUpdate = Partial<WorkoutSessionRow>;

export type CompletedSetRow = {
  id: string;
  client_uuid: string;
  workout_session_id: string;
  workout_exercise_id: string;
  user_id: string;
  set_number: number;
  side: 'left' | 'right' | 'both' | null;
  weight: number | null;
  weight_unit: UnitsWeight | null;
  reps: number | null;
  actual_rir: number | null;
  time_seconds: number | null;
  distance: number | null;
  distance_unit: UnitsDistance | null;
  pace: string | null;
  sprint_time: number | null;
  recovery_seconds: number | null;
  surface: string | null;
  effort_rating: number | null;
  quality_rating: number | null;
  technique_rating: number | null;
  pain_flag: boolean;
  pain_note: string | null;
  completion_status: 'completed' | 'skipped' | 'partial';
  notes: string | null;
  completed_at: string;
  synced_at: string | null;
  created_at: string;
};
export type CompletedSetInsert = Partial<CompletedSetRow> &
  Pick<CompletedSetRow, 'workout_session_id' | 'workout_exercise_id' | 'user_id' | 'set_number'>;
export type CompletedSetUpdate = Partial<CompletedSetRow>;

export type ReadinessEntryRow = {
  id: string;
  client_uuid: string;
  user_id: string;
  workout_session_id: string | null;
  entry_date: string;
  sleep_hours: number | null;
  resting_hr: number | null;
  baseline_resting_hr: number | null;
  calf_achilles_flag: boolean;
  hamstring_grabby_flag: boolean;
  joint_pain_flag: boolean;
  joint_pain_location: string | null;
  readiness_score: number | null;
  notes: string | null;
  created_at: string;
};
export type ReadinessEntryInsert = Partial<ReadinessEntryRow> &
  Pick<ReadinessEntryRow, 'user_id' | 'entry_date'>;
export type ReadinessEntryUpdate = Partial<ReadinessEntryRow>;

export type SafetyAdjustmentRow = {
  id: string;
  user_id: string;
  workout_session_id: string | null;
  readiness_entry_id: string | null;
  trigger_code: SafetyTriggerCode;
  reason: string;
  recommended_adjustment: string;
  original_prescription_snapshot: unknown;
  adjusted_prescription_snapshot: unknown;
  user_confirmed: boolean;
  confirmed_at: string | null;
  created_at: string;
};
export type SafetyAdjustmentInsert = Partial<SafetyAdjustmentRow> &
  Pick<SafetyAdjustmentRow, 'user_id' | 'trigger_code' | 'reason' | 'recommended_adjustment'>;
export type SafetyAdjustmentUpdate = Partial<SafetyAdjustmentRow>;

export type TestingSessionRow = {
  id: string;
  user_id: string;
  enrollment_id: string;
  event_key: TestingEventKey;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
export type TestingSessionInsert = Partial<TestingSessionRow> &
  Pick<TestingSessionRow, 'user_id' | 'enrollment_id' | 'event_key'>;
export type TestingSessionUpdate = Partial<TestingSessionRow>;

export type TestingResultRow = {
  id: string;
  client_uuid: string;
  testing_session_id: string;
  user_id: string;
  marker_number: number;
  attempt_number: number;
  side: 'left' | 'right' | 'both' | null;
  value_numeric: number | null;
  value_text: string | null;
  is_best_attempt: boolean;
  classification: 'below_baseline' | 'baseline' | 'solid' | 'strong' | null;
  notes: string | null;
  recorded_at: string;
};
export type TestingResultInsert = Partial<TestingResultRow> &
  Pick<TestingResultRow, 'testing_session_id' | 'user_id' | 'marker_number'>;
export type TestingResultUpdate = Partial<TestingResultRow>;

export type ExerciseMaxRow = {
  id: string;
  user_id: string;
  lift_key: string;
  estimated_1rm: number;
  weight_unit: UnitsWeight;
  method: string;
  source: 'manual' | 'testing_session' | 'week8_recalc' | 'set_derived';
  workout_session_id: string | null;
  testing_session_id: string | null;
  effective_from_week: number | null;
  recorded_at: string;
};
export type ExerciseMaxInsert = Partial<ExerciseMaxRow> &
  Pick<ExerciseMaxRow, 'user_id' | 'lift_key' | 'estimated_1rm'>;
export type ExerciseMaxUpdate = Partial<ExerciseMaxRow>;

export type PersonalRecordRow = {
  id: string;
  user_id: string;
  record_type: string;
  reference_key: string;
  value_numeric: number;
  unit: string;
  achieved_at: string;
  workout_session_id: string | null;
  testing_result_id: string | null;
  created_at: string;
};
export type PersonalRecordInsert = Partial<PersonalRecordRow> &
  Pick<PersonalRecordRow, 'user_id' | 'record_type' | 'reference_key' | 'value_numeric' | 'unit'>;
export type PersonalRecordUpdate = Partial<PersonalRecordRow>;

export type SportSessionRow = {
  id: string;
  user_id: string;
  played_on: string;
  sport: string;
  games_this_week: number;
  pregame_warmup_completed: boolean;
  applied_adjustment_code: string | null;
  applied_adjustment_note: string | null;
  user_confirmed: boolean;
  affected_workout_session_id: string | null;
  notes: string | null;
  created_at: string;
};
export type SportSessionInsert = Partial<SportSessionRow> &
  Pick<SportSessionRow, 'user_id' | 'played_on' | 'sport'>;
export type SportSessionUpdate = Partial<SportSessionRow>;

export type JournalEntryRow = {
  id: string;
  user_id: string;
  level: JournalLevel;
  workout_session_id: string | null;
  workout_exercise_id: string | null;
  completed_set_id: string | null;
  prompt_key: string | null;
  content: string;
  created_at: string;
};
export type JournalEntryInsert = Partial<JournalEntryRow> &
  Pick<JournalEntryRow, 'user_id' | 'level' | 'content'>;
export type JournalEntryUpdate = Partial<JournalEntryRow>;

export type NotificationPreferencesRow = {
  user_id: string;
  am_session_reminder_enabled: boolean;
  am_reminder_time: string;
  pm_session_reminder_enabled: boolean;
  pm_reminder_time: string;
  readiness_check_reminder_enabled: boolean;
  rest_day_reminder_enabled: boolean;
  testing_reminder_enabled: boolean;
  timezone: string;
  updated_at: string;
};
export type NotificationPreferencesInsert = Partial<NotificationPreferencesRow> & {
  user_id: string;
};
export type NotificationPreferencesUpdate = Partial<NotificationPreferencesRow>;

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, ProfileInsert, ProfileUpdate>;
      program_versions: TableDef<ProgramVersionRow, ProgramVersionInsert, ProgramVersionUpdate>;
      program_weeks: TableDef<ProgramWeekRow, ProgramWeekInsert, ProgramWeekUpdate>;
      program_days: TableDef<ProgramDayRow, ProgramDayInsert, ProgramDayUpdate>;
      exercise_templates: TableDef<
        ExerciseTemplateRow,
        ExerciseTemplateInsert,
        ExerciseTemplateUpdate
      >;
      substitutions: TableDef<SubstitutionRow, SubstitutionInsert, SubstitutionUpdate>;
      workout_templates: TableDef<WorkoutTemplateRow, WorkoutTemplateInsert, WorkoutTemplateUpdate>;
      workout_exercises: TableDef<WorkoutExerciseRow, WorkoutExerciseInsert, WorkoutExerciseUpdate>;
      prescribed_sets: TableDef<PrescribedSetRow, PrescribedSetInsert, PrescribedSetUpdate>;
      am_week_overlays: TableDef<AmWeekOverlayRow, AmWeekOverlayInsert, AmWeekOverlayUpdate>;
      testing_marker_defs: TableDef<
        TestingMarkerDefRow,
        TestingMarkerDefInsert,
        TestingMarkerDefUpdate
      >;
      program_enrollments: TableDef<
        ProgramEnrollmentRow,
        ProgramEnrollmentInsert,
        ProgramEnrollmentUpdate
      >;
      workout_sessions: TableDef<WorkoutSessionRow, WorkoutSessionInsert, WorkoutSessionUpdate>;
      completed_sets: TableDef<CompletedSetRow, CompletedSetInsert, CompletedSetUpdate>;
      readiness_entries: TableDef<ReadinessEntryRow, ReadinessEntryInsert, ReadinessEntryUpdate>;
      safety_adjustments: TableDef<
        SafetyAdjustmentRow,
        SafetyAdjustmentInsert,
        SafetyAdjustmentUpdate
      >;
      testing_sessions: TableDef<TestingSessionRow, TestingSessionInsert, TestingSessionUpdate>;
      testing_results: TableDef<TestingResultRow, TestingResultInsert, TestingResultUpdate>;
      exercise_maxes: TableDef<ExerciseMaxRow, ExerciseMaxInsert, ExerciseMaxUpdate>;
      personal_records: TableDef<PersonalRecordRow, PersonalRecordInsert, PersonalRecordUpdate>;
      sport_sessions: TableDef<SportSessionRow, SportSessionInsert, SportSessionUpdate>;
      journal_entries: TableDef<JournalEntryRow, JournalEntryInsert, JournalEntryUpdate>;
      notification_preferences: TableDef<
        NotificationPreferencesRow,
        NotificationPreferencesInsert,
        NotificationPreferencesUpdate
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      block_name: BlockName;
      session_slot: SessionSlot;
      session_type: SessionType;
      load_type: LoadType;
      workout_status: WorkoutStatus;
      enrollment_status: EnrollmentStatus;
      testing_event_key: TestingEventKey;
      marker_layer: MarkerLayer;
      journal_level: JournalLevel;
      safety_trigger_code: SafetyTriggerCode;
      profile_role: ProfileRole;
      units_weight: UnitsWeight;
      units_distance: UnitsDistance;
    };
  };
};
