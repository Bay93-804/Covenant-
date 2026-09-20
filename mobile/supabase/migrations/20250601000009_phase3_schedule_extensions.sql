-- Phase 3: minimal schema extension for the schedule engine's pause/resume
-- and block-restart support (docs/phase1/DATABASE_SCHEMA.md already models
-- "restart-at-block-start" via `program_enrollments.current_week_override`,
-- but has no way to record *when* a restart's new week numbering should
-- start counting from, nor any history of pause/resume windows — both are
-- required to recompute the schedule for "today" without ever touching a
-- historical `workout_sessions` row (which keeps its own `scheduled_date`
-- forever once created, per the Phase 1 design principle).
--
-- This does not reinterpret or add to the approved program content — it is
-- purely enrollment-instance bookkeeping the schedule engine needs.

alter table program_enrollments
  add column if not exists restart_anchor_date date;

comment on column program_enrollments.restart_anchor_date is
  'Calendar date (a Monday) that current_week_override''s week begins counting from. Null unless the enrollment has been restarted at a block start.';

create table enrollment_pause_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references program_enrollments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paused_at timestamptz not null default now(),
  resumed_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);
create index on enrollment_pause_events (enrollment_id, paused_at);
create index on enrollment_pause_events (user_id) where resumed_at is null;

alter table enrollment_pause_events enable row level security;
create policy "own rows select" on enrollment_pause_events for select using (user_id = auth.uid());
create policy "own rows insert" on enrollment_pause_events for insert with check (user_id = auth.uid());
create policy "own rows update" on enrollment_pause_events for update using (user_id = auth.uid());
create policy "own rows delete" on enrollment_pause_events for delete using (user_id = auth.uid());
