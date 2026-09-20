-- Testing: Week 0 / Week 6 / Week 12. docs/phase1/DATABASE_SCHEMA.md §"Testing"
--
-- Week 0 and Week 12 are multi-day test events; scheduled_date is a
-- target/window-start date, not a single testing day. Week 6 intentionally
-- carries only 6 of the 15 markers (see testing_marker_defs / content
-- JSON's testing.events.week6.markers) — this table has no marker-count
-- constraint, so a partial Week 6 session and full Week 0/12 sessions are
-- all valid rows; "which markers belong to which event" is enforced at the
-- content + application layer, not by a DB constraint.

create table testing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references program_enrollments(id) on delete cascade,
  event_key testing_event_key not null,
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enrollment_id, event_key)
);

create table testing_results (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null default gen_random_uuid(),
  testing_session_id uuid not null references testing_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  marker_number int not null,
  attempt_number int not null default 1,
  side text check (side in ('left','right','both',null)),
  value_numeric numeric(10,3),
  value_text text,
  is_best_attempt boolean not null default false,
  classification text check (classification in ('below_baseline','baseline','solid','strong', null)),
  notes text,
  recorded_at timestamptz not null default now(),
  unique (client_uuid)
);
create index on testing_results (testing_session_id, marker_number);
create index on testing_results (user_id, marker_number, recorded_at);

create table exercise_maxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lift_key text not null,
  estimated_1rm numeric(7,2) not null,
  weight_unit units_weight not null default 'lb',
  method text not null default 'heavy_5_rir1_x1.15',
  source text not null default 'manual' check (source in ('manual','testing_session','week8_recalc','set_derived')),
  workout_session_id uuid references workout_sessions(id),
  testing_session_id uuid references testing_sessions(id),
  effective_from_week int,
  recorded_at timestamptz not null default now()
);
create index on exercise_maxes (user_id, lift_key, recorded_at desc);

create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null,
  reference_key text not null,
  value_numeric numeric(10,3) not null,
  unit text not null,
  achieved_at timestamptz not null default now(),
  workout_session_id uuid references workout_sessions(id),
  testing_result_id uuid references testing_results(id),
  created_at timestamptz not null default now()
);
create index on personal_records (user_id, record_type, reference_key);
