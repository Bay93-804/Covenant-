-- Restart Program: archive the current program run and start a new one at
-- Week 1, Day 1.
--
-- A "program run" is one `program_enrollments` row. Every piece of history
-- (workout_sessions, completed_sets, testing_sessions/results, pause events)
-- is keyed to its enrollment_id, and readiness/exercise maxes/PRs are keyed
-- to the user — so archiving the old row and inserting a new one preserves
-- all of it untouched. Program content (program_versions & children) is
-- only referenced, never copied or modified.
--
-- Additive only: one new column, a one-time normalization of any duplicate
-- current runs, a partial unique index, and an RPC.

alter table program_enrollments
  add column if not exists archived_at timestamptz;

comment on column program_enrollments.archived_at is
  'When this run stopped being the user''s current run (e.g. Restart Program). Null while active/paused.';

-- Before this migration nothing prevented a user from holding several
-- active/paused runs (the client always read the newest). Keep the newest
-- as current and archive the rest as ''abandoned'' — no rows are deleted,
-- so their history stays intact and queryable.
with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from program_enrollments
  where status in ('active', 'paused')
)
update program_enrollments e
set status = 'abandoned',
    archived_at = coalesce(e.archived_at, now())
from ranked r
where e.id = r.id
  and r.rn > 1;

-- At most one current (active or paused) run per user — the hard guard
-- behind Restart Program's idempotency, and against any direct table insert.
create unique index if not exists program_enrollments_one_current_per_user
  on program_enrollments (user_id)
  where status in ('active', 'paused');

create index if not exists program_enrollments_restarted_from_idx
  on program_enrollments (restarted_from_enrollment_id);

create index if not exists program_enrollments_user_created_idx
  on program_enrollments (user_id, created_at desc);

-- restart_program(current_enrollment_id, new_start_date)
--
-- Atomically archives the caller's current run and inserts the new one.
-- SECURITY INVOKER: runs under the caller's own RLS policies, and only ever
-- touches rows where user_id = auth.uid().
--
-- Idempotent: a repeated call with the same p_current_enrollment_id (double
-- tap, network retry after a lost response) returns the run that the first
-- call created instead of creating another. Concurrent calls are serialized
-- by a per-user advisory lock; the partial unique index above is the final
-- backstop.
--
-- Error codes (SQLSTATE) the client maps to messages:
--   CCR01  not authenticated
--   CCR02  new start date is not a Monday
--   CCR03  enrollment not found for this user
--   CCR04  enrollment is no longer the current run (and wasn't restarted into one)
create or replace function public.restart_program(
  p_current_enrollment_id uuid,
  p_new_start_date date
) returns program_enrollments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_current program_enrollments;
  v_new program_enrollments;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'CCR01';
  end if;

  if p_new_start_date is null or extract(isodow from p_new_start_date) <> 1 then
    raise exception 'Week 1 must start on a Monday' using errcode = 'CCR02';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('restart_program:' || v_user::text, 0));

  select * into v_current
  from program_enrollments
  where id = p_current_enrollment_id
    and user_id = v_user
  for update;

  if not found then
    raise exception 'Program run not found' using errcode = 'CCR03';
  end if;

  if v_current.status not in ('active', 'paused') then
    select * into v_new
    from program_enrollments
    where user_id = v_user
      and restarted_from_enrollment_id = v_current.id
      and status in ('active', 'paused')
    limit 1;

    if found then
      return v_new;
    end if;

    raise exception 'This program run is no longer current' using errcode = 'CCR04';
  end if;

  update program_enrollments
  set status = 'restarted',
      archived_at = now()
  where id = v_current.id;

  insert into program_enrollments (
    user_id,
    program_version_id,
    coach_id,
    start_date,
    status,
    restarted_from_enrollment_id
  ) values (
    v_user,
    v_current.program_version_id,
    v_current.coach_id,
    p_new_start_date,
    'active',
    v_current.id
  )
  returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.restart_program(uuid, date) from public;
revoke all on function public.restart_program(uuid, date) from anon;
grant execute on function public.restart_program(uuid, date) to authenticated;
