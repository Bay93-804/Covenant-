-- Sport-adjustment mode, journal, notifications.
-- docs/phase1/DATABASE_SCHEMA.md §"Sport adjustment mode" / "Journal" / "Notifications"

create table sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_on date not null,
  sport text not null,
  games_this_week int not null default 1,
  pregame_warmup_completed boolean not null default false,
  applied_adjustment_code text,
  applied_adjustment_note text,
  user_confirmed boolean not null default false,
  affected_workout_session_id uuid references workout_sessions(id),
  notes text,
  created_at timestamptz not null default now()
);
create index on sport_sessions (user_id, played_on);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level journal_level not null,
  workout_session_id uuid references workout_sessions(id) on delete cascade,
  workout_exercise_id uuid references workout_exercises(id),
  completed_set_id uuid references completed_sets(id),
  prompt_key text,
  content text not null,
  created_at timestamptz not null default now()
);
create index on journal_entries (user_id, level, created_at);

create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  am_session_reminder_enabled boolean not null default true,
  am_reminder_time time not null default '06:30',
  pm_session_reminder_enabled boolean not null default true,
  pm_reminder_time time not null default '17:30',
  readiness_check_reminder_enabled boolean not null default true,
  rest_day_reminder_enabled boolean not null default false,
  testing_reminder_enabled boolean not null default true,
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);
