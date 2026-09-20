-- Enrollment & scheduling (user-owned instance data).
-- docs/phase1/DATABASE_SCHEMA.md §"Enrollment & scheduling"

create table program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_version_id uuid not null references program_versions(id),
  coach_id uuid references auth.users(id),
  start_date date not null,
  status enrollment_status not null default 'active',
  current_week_override int,
  paused_at timestamptz,
  restarted_from_enrollment_id uuid references program_enrollments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on program_enrollments (user_id) where status = 'active';

create trigger trg_enrollments_updated before update on program_enrollments for each row execute function set_updated_at();

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null default gen_random_uuid(),
  enrollment_id uuid not null references program_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid not null references program_days(id),
  workout_template_id uuid not null references workout_templates(id),
  scheduled_date date not null,
  session_slot session_slot not null,
  status workout_status not null default 'scheduled',
  readiness_entry_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  duration_actual_seconds int,
  completion_pct numeric(5,2),
  abandoned boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_uuid),
  unique (enrollment_id, scheduled_date, session_slot)
);
create index on workout_sessions (user_id, scheduled_date);
create index on workout_sessions (enrollment_id, status);

create trigger trg_sessions_updated before update on workout_sessions for each row execute function set_updated_at();

create table completed_sets (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  workout_exercise_id uuid not null references workout_exercises(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number int not null,
  side text check (side in ('left', 'right', 'both', null)),
  weight numeric(7,2), weight_unit units_weight,
  reps int,
  actual_rir numeric(3,1),
  time_seconds numeric(8,2),
  distance numeric(8,2), distance_unit units_distance,
  pace text,
  sprint_time numeric(6,3),
  recovery_seconds int,
  surface text,
  effort_rating smallint check (effort_rating between 1 and 10),
  quality_rating smallint check (quality_rating between 1 and 5),
  technique_rating smallint check (technique_rating between 1 and 5),
  pain_flag boolean not null default false,
  pain_note text,
  completion_status text not null default 'completed' check (completion_status in ('completed','skipped','partial')),
  notes text,
  completed_at timestamptz not null default now(),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_uuid),
  unique (workout_exercise_id, workout_session_id, set_number, side)
);
create index on completed_sets (workout_session_id);
create index on completed_sets (user_id, completed_at);
