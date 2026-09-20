# Database Schema — Phase 1 Plan
## Coach Conde — The Long Game: Athletic Edition

Postgres (Supabase). This is the Phase 1 design; Phase 2 turns it into numbered migrations under `supabase/migrations/`. Nothing here is applied yet.

## Design principles

1. **Content vs. instance separation.** `program_versions` / `program_weeks` / `program_days` / `workout_templates` / `exercise_templates` / `workout_exercises` / `prescribed_sets` hold the *prescribed* program (versioned, importable from `data/program/*.json`, never user-specific). `program_enrollments` / `workout_sessions` / `completed_sets` / everything below them hold *what a specific user actually did*. This lets a future "Edition 2.0" ship as a new `program_versions` row without touching history.
2. **Never overwrite history.** `workout_sessions` are keyed by `(enrollment_id, program_day_id, session_slot, scheduled_date)` — reopening a past day loads its own row; it never reuses today's. If the program schedule shifts (restart, pause), old sessions keep their original `scheduled_date` and `program_day_id`.
3. **Offline-sync safety.** Every user-writable table has a client-generated `client_uuid` (UUID, unique) so the offline queue can retry a push without creating duplicates (`ON CONFLICT (client_uuid) DO NOTHING/UPDATE`).
4. **RLS ownership.** Every user-data table has `user_id uuid references auth.users(id)` and a policy `user_id = auth.uid()`. Program-content tables are readable by any authenticated user and writable only by a `service_role`/admin (future coach-dashboard writes go through a server function, not client RLS).
5. **Admin-readiness.** `program_enrollments.coach_id` (nullable now) and `profiles.role` (`athlete` default, `coach` future) exist from day one so a coach dashboard can be added without a schema migration that touches existing rows.

---

## Entity overview

```
program_versions ─┬─ program_weeks ─┬─ program_days ─┬─ workout_templates ─┬─ workout_exercises ─┬─ prescribed_sets
                   │                │                │                     └─ (exercise_templates)
                   │                │                └─ (am template refs: speed/core-balance-brake/mobility — see note)
                   └─ testing_marker_defs

exercise_templates ── substitutions (self-referencing + free text)

auth.users ─┬─ profiles
            ├─ program_enrollments ── program_versions
            │        │
            │        ├─ workout_sessions ─┬─ completed_sets
            │        │                    └─ readiness_entries (FK, nullable)
            │        ├─ testing_sessions ── testing_results
            │        ├─ exercise_maxes
            │        ├─ safety_adjustments
            │        ├─ sport_sessions
            │        ├─ personal_records
            │        ├─ journal_entries
            │        └─ notification_preferences
```

Note: Monday AM (Speed & Plyo), Tuesday AM (Core/Balance/Brake), and the Mobility Flow are structurally block-level (not per-exercise progressed like PM strength) with a week-level overlay (`weeklySpeedPlan`). They're modeled as `workout_templates` of `session_type = 'am_speed_plyo' | 'am_core_balance_brake' | 'am_tempo_agility' | 'am_long_run'` whose `workout_exercises` rows carry the block-level prescription and whose `prescribed_sets` (or a lighter `template_week_overrides` table, see §Open Question) carry the week-specific overlay text (e.g., exact yardages, sprint volume).

---

## DDL

```sql
-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- =========================================================
-- ENUM TYPES
-- =========================================================
create type block_name as enum ('absorb', 'build', 'express');
create type session_slot as enum ('am', 'pm');
create type session_type as enum (
  'am_speed_plyo', 'am_core_balance_brake', 'am_tempo_agility', 'am_long_run', 'am_rest',
  'pm_strength_a', 'pm_strength_b', 'pm_strength_c', 'pm_strength_d', 'pm_rest'
);
create type load_type as enum ('percentage', 'rir', 'quality_cap', 'bodyweight', 'time', 'distance', 'none');
create type workout_status as enum ('scheduled', 'in_progress', 'completed', 'skipped', 'adjusted');
create type enrollment_status as enum ('active', 'paused', 'completed', 'restarted', 'abandoned');
create type testing_event_key as enum ('week0', 'week6', 'week12', 'ad_hoc');
create type marker_layer as enum ('longevity_ten', 'athletic_five');
create type journal_level as enum ('set', 'exercise', 'workout', 'day');
create type safety_trigger_code as enum (
  'RHR_ELEVATED', 'CALF_ACHILLES_WARNING', 'SLEEP_UNDER_6H',
  'HAMSTRING_GRABBY', 'JOINT_PAIN_MOVEMENT_CHANGE', 'TWO_MISSED_WEEKS'
);
create type profile_role as enum ('athlete', 'coach');
create type units_weight as enum ('lb', 'kg');
create type units_distance as enum ('mi', 'km');

-- =========================================================
-- PROFILES  (1:1 with auth.users)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role profile_role not null default 'athlete',
  date_of_birth date,
  timezone text not null default 'UTC',
  units_weight units_weight not null default 'lb',
  units_distance units_distance not null default 'mi',
  bodyweight_lb numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PROGRAM CONTENT (versioned, admin/service-role writes only)
-- =========================================================
create table program_versions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- 'coach-conde-long-game-athletic-edition-v1'
  title text not null,
  edition text not null,
  duration_weeks int not null default 12,
  source_document text,
  content_json jsonb not null,               -- full raw import, for audit/replay
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  week_number int not null,                  -- 0-12 (0 = baseline)
  block block_name,                          -- null for week 0
  is_deload boolean not null default false,
  is_retest boolean not null default false,  -- week 6
  is_taper_and_test boolean not null default false, -- week 12
  narrative text,
  loading_pct_low int, loading_pct_high int,
  loading_rir_label text,
  unique (program_version_id, week_number)
);

create table program_days (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references program_weeks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Mon..6=Sun
  label text not null,                        -- 'Monday'
  unique (program_week_id, day_of_week)
);

create table exercise_templates (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  name text not null,
  movement_category text,                     -- hinge, squat, press, pull, jump, sprint, mobility, carry, iso...
  is_power_movement boolean not null default false,
  quality_cap boolean not null default false,  -- jumps/throws/sprints/plyo/brake: stop on quality loss, not rep count
  coaching_cue text,
  default_unit text,                           -- 'reps' | 'seconds' | 'yards' | 'each_side_reps' ...
  bilateral boolean not null default false,     -- has left/right tracking
  created_at timestamptz not null default now()
);

create table substitutions (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  missing_equipment_or_situation text not null,   -- 'A hill or a sled'
  use_instead text not null,                      -- free text ('Stadium steps, a treadmill at 8-10% incline...')
  exercise_template_id uuid references exercise_templates(id), -- nullable: not every substitution maps 1:1 to a template
  is_safety_rule boolean not null default false   -- e.g. "a joint that hurts" -> never substitute, refer out
);

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  session_slot session_slot not null,
  session_type session_type not null,
  title text not null,                          -- 'STRENGTH A — Hinge, Glute & Horizontal Power'
  main_lift text,                               -- 'Trap-Bar Deadlift' (nullable for AM sessions)
  est_minutes_low int, est_minutes_high int,
  is_contrast boolean not null default false,    -- Block 3 strength days
  unique (program_day_id, session_slot)
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_template_id uuid not null references exercise_templates(id),
  cluster_id text not null,                      -- 'A' | 'B' | 'C'
  cluster_label text,                            -- 'POWER PRIMER', 'MAIN HINGE & GLUTE', 'CONTRAST'...
  slot_order text not null,                       -- 'A1', 'B2', 'C4'
  rounds int not null,
  rest_label text,                                -- '75s' | '2:00'
  each_side boolean not null default false,
  is_combo boolean not null default false,        -- e.g. 'Face Pull + Band External Rotation'
  notes text,
  sort_index int not null,
  unique (workout_template_id, slot_order)
);

-- One row per in-block week (1-4 per block) per workout_exercise; the source PDF's
-- 4-column weekly tables map 1:1 onto this.
create table prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  week_number int not null,                       -- absolute program week (1-12)
  load_type load_type not null,
  load_value numeric,                             -- percentage (e.g. 75) or RIR (e.g. 2); null for quality_cap/bodyweight
  reps_display text not null,                      -- 'x8', '8x e/s', '40 yd e/s', '2:00' — exact PDF prescription text
  unique (workout_exercise_id, week_number)
);

-- Week-level overlay text for AM sessions whose specifics vary by week within a
-- block (drop-and-stick reps, hill/flat/flying yardages, sprint volume, tempo run
-- structure) rather than by a clean per-exercise 4-column table like PM strength.
create table am_week_overlays (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  week_number int not null,
  mon_am_detail text,
  thu_am_detail text,
  sat_am_minutes int,
  sprint_volume_yd int,                            -- null when 'test only'
  sprint_volume_note text,
  note text,
  is_deload boolean not null default false,
  is_retest boolean not null default false,
  is_test_week boolean not null default false,
  unique (program_version_id, week_number)
);

-- =========================================================
-- TESTING CONTENT (the 15 markers, versioned per program)
-- =========================================================
create table testing_marker_defs (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references program_versions(id) on delete cascade,
  marker_number int not null,                      -- 1-15
  layer marker_layer not null,
  name text not null,
  protocol text not null,
  unit text not null,
  direction text not null,                         -- 'lower_better' | 'higher_better' | 'qualitative'
  baseline_value text, solid_value text, strong_value text,
  bilateral boolean not null default false,
  attempts int,
  formula text,                                     -- e.g. e1RM or deceleration-deficit calc description
  caution_note text,                                -- e.g. sprint-test deferral warning
  unique (program_version_id, marker_number)
);

-- =========================================================
-- ENROLLMENT & SCHEDULING
-- =========================================================
create table program_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_version_id uuid not null references program_versions(id),
  coach_id uuid references auth.users(id),          -- nullable; future coach-dashboard hook
  start_date date not null,
  status enrollment_status not null default 'active',
  current_week_override int,                        -- set on restart-at-block-start
  paused_at timestamptz,
  restarted_from_enrollment_id uuid references program_enrollments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on program_enrollments (user_id) where status = 'active';

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null default gen_random_uuid(),  -- offline idempotency key
  enrollment_id uuid not null references program_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid not null references program_days(id),
  workout_template_id uuid not null references workout_templates(id),
  scheduled_date date not null,
  session_slot session_slot not null,
  status workout_status not null default 'scheduled',
  readiness_entry_id uuid,                            -- FK added after readiness_entries below
  started_at timestamptz,
  completed_at timestamptz,
  duration_actual_seconds int,
  completion_pct numeric(5,2),
  abandoned boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_uuid),
  unique (enrollment_id, scheduled_date, session_slot)  -- never overwrite a past day
);
create index on workout_sessions (user_id, scheduled_date);
create index on workout_sessions (enrollment_id, status);

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

-- =========================================================
-- READINESS & SAFETY
-- =========================================================
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

-- =========================================================
-- TESTING (Week 0 / Week 6 / Week 12)
-- =========================================================
-- One testing_session per event (week0/week6/week12), even though Week 0 and Week 12
-- are multi-day test events by protocol (Week 0: >=3 mornings for resting HR alone,
-- plus a separate fresh Athletic Five day; Week 12: a 3-day Wed/Thu/Sat test week —
-- see program_content's testing.events.week0/week12 and EXTRACTION_AUDIT.md #1/#2).
-- scheduled_date is a target/window-start date, not a single testing day; each
-- individual marker's actual day is captured on its own testing_results.recorded_at,
-- so multi-day completion is tracked at the result level, not the session level.
-- Week 0's day-by-day grouping is an app-suggested, explicitly flexible schedule
-- (content_json.testing.events.week0.suggestedSchedule, isFlexible=true) — the schema
-- does not hard-code specific weekdays for it. Week 6 intentionally carries only 6 of
-- the 15 markers (see testing_marker_defs / testing.events.week6.markers in content
-- JSON) plus a conditional 10-yard-sprint marker when deferred at Week 0 — this table
-- has no marker-count constraint, so a partial Week 6 and full Week 0/12 sessions are
-- both valid rows; enforcement of "which markers belong to which event" is a content-
-- and application-layer rule (testing_marker_defs joined with each event's marker
-- list), not a DB constraint.
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
  marker_number int not null,                       -- 1-15
  attempt_number int not null default 1,
  side text check (side in ('left','right','both',null)),
  value_numeric numeric(10,3),
  value_text text,                                   -- qualitative markers (shoulder flexion)
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
  lift_key text not null,                            -- 'trap_bar_deadlift' | 'back_squat' | 'bench_press'
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
  record_type text not null,                          -- 'exercise_weight' | 'testing_marker' | 'sprint_time' | 'jump_height'...
  reference_key text not null,                         -- exercise_template_id or marker_number as text
  value_numeric numeric(10,3) not null,
  unit text not null,
  achieved_at timestamptz not null default now(),
  workout_session_id uuid references workout_sessions(id),
  testing_result_id uuid references testing_results(id),
  created_at timestamptz not null default now()
);
create index on personal_records (user_id, record_type, reference_key);

-- =========================================================
-- SPORT ADJUSTMENT MODE
-- =========================================================
create table sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_on date not null,
  sport text not null,
  games_this_week int not null default 1,
  pregame_warmup_completed boolean not null default false,
  applied_adjustment_code text,                        -- e.g. 'REPLACE_THU_AGILITY' | 'REDUCE_MON_SPEED' | 'MOVE_STRENGTH_D'
  applied_adjustment_note text,
  user_confirmed boolean not null default false,
  affected_workout_session_id uuid references workout_sessions(id),
  notes text,
  created_at timestamptz not null default now()
);
create index on sport_sessions (user_id, played_on);

-- =========================================================
-- JOURNAL
-- =========================================================
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level journal_level not null,
  workout_session_id uuid references workout_sessions(id) on delete cascade,
  workout_exercise_id uuid references workout_exercises(id),
  completed_set_id uuid references completed_sets(id),
  prompt_key text,                                     -- 'felt_strong' | 'needs_attention' | 'trained_with_quality' | 'carry_forward' | null (free note)
  content text not null,
  created_at timestamptz not null default now()
);
create index on journal_entries (user_id, level, created_at);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
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

-- =========================================================
-- updated_at trigger helper
-- =========================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_enrollments_updated before update on program_enrollments for each row execute function set_updated_at();
create trigger trg_sessions_updated before update on workout_sessions for each row execute function set_updated_at();
```

---

## Row-Level Security

```sql
alter table profiles enable row level security;
alter table program_enrollments enable row level security;
alter table workout_sessions enable row level security;
alter table completed_sets enable row level security;
alter table readiness_entries enable row level security;
alter table safety_adjustments enable row level security;
alter table testing_sessions enable row level security;
alter table testing_results enable row level security;
alter table exercise_maxes enable row level security;
alter table personal_records enable row level security;
alter table sport_sessions enable row level security;
alter table journal_entries enable row level security;
alter table notification_preferences enable row level security;

-- Program content tables: readable by any authenticated user, writes reserved for service_role.
alter table program_versions enable row level security;
alter table program_weeks enable row level security;
alter table program_days enable row level security;
alter table workout_templates enable row level security;
alter table workout_exercises enable row level security;
alter table prescribed_sets enable row level security;
alter table am_week_overlays enable row level security;
alter table exercise_templates enable row level security;
alter table substitutions enable row level security;
alter table testing_marker_defs enable row level security;

create policy "content readable by authenticated" on program_versions for select using (auth.role() = 'authenticated');
-- (repeat identical select policy for program_weeks, program_days, workout_templates,
--  workout_exercises, prescribed_sets, am_week_overlays, exercise_templates,
--  substitutions, testing_marker_defs — omitted here for brevity, same pattern)
create policy "content writable by service role only" on program_versions for all using (auth.role() = 'service_role');

-- Ownership pattern, applied identically to every *_entries / *_sessions / *_sets /
-- *_records / *_adjustments / *_maxes table with a direct user_id column:
create policy "own rows select" on program_enrollments for select using (user_id = auth.uid());
create policy "own rows insert" on program_enrollments for insert with check (user_id = auth.uid());
create policy "own rows update" on program_enrollments for update using (user_id = auth.uid());
create policy "own rows delete" on program_enrollments for delete using (user_id = auth.uid());
-- Repeat the same four policies for: workout_sessions, completed_sets, readiness_entries,
-- safety_adjustments, testing_sessions, testing_results, exercise_maxes, personal_records,
-- sport_sessions, journal_entries. notification_preferences and profiles use `id = auth.uid()`
-- instead of `user_id = auth.uid()` since they're keyed directly on the user id.

-- Coach-dashboard readiness (future, inert until a coach role exists — commented out for MVP):
-- create policy "coach can read assigned athlete data" on workout_sessions for select
--   using (exists (
--     select 1 from program_enrollments e
--     where e.id = workout_sessions.enrollment_id and e.coach_id = auth.uid()
--   ));
```

## Indexing rationale

- `workout_sessions (user_id, scheduled_date)` — Today screen + calendar month view.
- `workout_sessions (enrollment_id, status)` — adherence rollups.
- `completed_sets (workout_session_id)` — workout player hydration.
- `testing_results (user_id, marker_number, recorded_at)` — Week 0/6/12 comparison charts.
- `exercise_maxes (user_id, lift_key, recorded_at desc)` — "current e1RM" lookup for load calculator (`select ... limit 1`).
- Partial index `program_enrollments (user_id) where status = 'active'` — fast "my active enrollment" lookup, the single query that gates the whole app shell.

## Offline sync strategy

- Every user-writable row carries `client_uuid` generated on-device at creation time (before any network round-trip).
- Local (SQLite/MMKV, Phase 2 decision) queues writes keyed by `client_uuid`; sync worker upserts via `client_uuid` unique constraint — replay-safe, so a retried push never duplicates a set or session.
- `workout_sessions.synced_at` / `completed_sets.synced_at` null = pending sync; UI shows an offline badge, never blocks logging.

## Deferred (not in MVP tables, noted for Phase 2 awareness)

- Coach-dashboard write paths (`coach_id` column exists; no coach UI or elevated RLS policy ships in MVP per the spec's explicit instruction).
- Multi-program-per-user history is supported structurally (`program_enrollments` is not unique-per-user) even though MVP only ever creates one active enrollment at a time.
