-- Readiness & safety. docs/phase1/DATABASE_SCHEMA.md §"Readiness & safety"

create table readiness_entries (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid references workout_sessions(id) on delete set null,
  entry_date date not null,
  sleep_hours numeric(4,1),
  resting_hr int,
  baseline_resting_hr int,
  calf_achilles_flag boolean not null default false,
  hamstring_grabby_flag boolean not null default false,
  joint_pain_flag boolean not null default false,
  joint_pain_location text,
  readiness_score smallint check (readiness_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  unique (client_uuid)
);
create index on readiness_entries (user_id, entry_date);

alter table workout_sessions
  add constraint fk_workout_sessions_readiness
  foreign key (readiness_entry_id) references readiness_entries(id) on delete set null;

create table safety_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid references workout_sessions(id) on delete cascade,
  readiness_entry_id uuid references readiness_entries(id),
  trigger_code safety_trigger_code not null,
  reason text not null,
  recommended_adjustment text not null,
  original_prescription_snapshot jsonb,
  adjusted_prescription_snapshot jsonb,
  user_confirmed boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on safety_adjustments (user_id, created_at);
