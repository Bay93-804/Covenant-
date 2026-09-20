-- Program content (versioned, importable, admin/service-role writes only).
-- docs/phase1/DATABASE_SCHEMA.md §"Program content"

create table program_versions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  edition text not null,
  duration_weeks int not null default 12,
  source_document text,
  content_json jsonb not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  week_number int not null,
  block block_name,
  is_deload boolean not null default false,
  is_retest boolean not null default false,
  is_taper_and_test boolean not null default false,
  narrative text,
  loading_pct_low int, loading_pct_high int,
  loading_rir_label text,
  unique (program_version_id, week_number)
);

create table program_days (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references program_weeks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  label text not null,
  unique (program_week_id, day_of_week)
);

create table exercise_templates (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  name text not null,
  movement_category text,
  is_power_movement boolean not null default false,
  quality_cap boolean not null default false,
  coaching_cue text,
  default_unit text,
  bilateral boolean not null default false,
  created_at timestamptz not null default now()
);

create table substitutions (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  missing_equipment_or_situation text not null,
  use_instead text not null,
  exercise_template_id uuid references exercise_templates(id),
  is_safety_rule boolean not null default false
);

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  session_slot session_slot not null,
  session_type session_type not null,
  title text not null,
  main_lift text,
  est_minutes_low int, est_minutes_high int,
  is_contrast boolean not null default false,
  unique (program_day_id, session_slot)
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_template_id uuid not null references exercise_templates(id),
  cluster_id text not null,
  cluster_label text,
  slot_order text not null,
  rounds int not null,
  rest_label text,
  each_side boolean not null default false,
  is_combo boolean not null default false,
  notes text,
  sort_index int not null,
  unique (workout_template_id, slot_order)
);

create table prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  week_number int not null,
  load_type load_type not null,
  load_value numeric,
  reps_display text not null,
  unique (workout_exercise_id, week_number)
);

create table am_week_overlays (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  week_number int not null,
  mon_am_detail text,
  thu_am_detail text,
  sat_am_minutes int,
  sprint_volume_yd int,
  sprint_volume_note text,
  note text,
  is_deload boolean not null default false,
  is_retest boolean not null default false,
  is_test_week boolean not null default false,
  unique (program_version_id, week_number)
);

create table testing_marker_defs (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  marker_number int not null,
  layer marker_layer not null,
  name text not null,
  protocol text not null,
  unit text not null,
  direction text not null,
  baseline_value text, solid_value text, strong_value text,
  bilateral boolean not null default false,
  attempts int,
  formula text,
  caution_note text,
  unique (program_version_id, marker_number)
);
