-- Restart Program: archive-and-restart, idempotency, one current run,
-- history preservation, authorization. Run via scripts/test-db.sh.
\set ON_ERROR_STOP on

-- Users: A (restarts), B (attacker / bystander).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b@example.com');
insert into program_enrollments (id, user_id, program_version_id, start_date, status, created_at)
values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', '2026-09-07', 'active', '2026-09-01T00:00:00Z'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', '2026-09-07', 'active', '2026-09-01T00:00:00Z');
select test_seed_history('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'a');

create temp table snapshot_before as
select 'workout_sessions' as t, count(*) as n, md5(string_agg(to_jsonb(x)::text, '' order by x.id)) as h from workout_sessions x
union all select 'completed_sets', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from completed_sets x
union all select 'testing_sessions', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from testing_sessions x
union all select 'testing_results', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from testing_results x
union all select 'readiness_entries', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from readiness_entries x
union all select 'enrollment_pause_events', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from enrollment_pause_events x
union all select 'exercise_maxes', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from exercise_maxes x
union all select 'program_versions', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from program_versions x
union all select 'workout_templates', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from workout_templates x;
grant select on snapshot_before to public;

-- 0. Migration normalized the pre-existing duplicate current runs.
select test_assert(
  (select count(*) from program_enrollments
    where user_id = '99999999-0000-0000-0000-000000000000' and status in ('active','paused')) = 1,
  'migration left exactly one current run for a user who had duplicates');
select test_assert(
  (select status::text from program_enrollments where id = '99999999-0000-0000-0000-0000000000e2') = 'active'
  and (select status::text from program_enrollments where id = '99999999-0000-0000-0000-0000000000e1') = 'abandoned'
  and (select archived_at is not null from program_enrollments where id = '99999999-0000-0000-0000-0000000000e1'),
  'migration kept the newest run current and archived (not deleted) the older one');

-- 1. Archive and restart.
begin;
select test_act_as('aaaaaaaa-0000-0000-0000-000000000000');
create temp table first_restart on commit drop as
  select * from restart_program('aaaaaaaa-0000-0000-0000-0000000000e1', '2026-10-26');
select test_assert((select status::text from first_restart) = 'active', 'new run is active');
select test_assert((select start_date from first_restart) = '2026-10-26', 'new run starts Week 1 on the chosen Monday');
select test_assert((select restarted_from_enrollment_id from first_restart) = 'aaaaaaaa-0000-0000-0000-0000000000e1',
  'new run links back to the archived run');
select test_assert((select program_version_id from first_restart) = '00000000-0000-0000-0000-0000000000a1',
  'new run references the same seeded program version');
select test_assert((select current_week_override is null and restart_anchor_date is null from first_restart),
  'new run has no block-restart override (Week 1, Day 1)');
select test_assert(
  (select status::text from program_enrollments where id = 'aaaaaaaa-0000-0000-0000-0000000000e1') = 'restarted'
  and (select archived_at is not null from program_enrollments where id = 'aaaaaaaa-0000-0000-0000-0000000000e1'),
  'old run is archived as restarted with archived_at');

-- 2. Duplicate restart attempt (double tap / retry) returns the same run.
create temp table second_restart on commit drop as
  select * from restart_program('aaaaaaaa-0000-0000-0000-0000000000e1', '2026-10-26');
select test_assert((select id from second_restart) = (select id from first_restart),
  'repeated restart of the same run is idempotent');
select test_assert(
  (select count(*) from program_enrollments where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' and status in ('active','paused')) = 1,
  'still exactly one current run after a duplicate restart');
commit;

-- 3. History preserved byte-for-byte; content untouched.
select test_assert(
  not exists (
    select 1 from snapshot_before b
    join (
      select 'workout_sessions' as t, count(*) as n, md5(string_agg(to_jsonb(x)::text, '' order by x.id)) as h from workout_sessions x
      union all select 'completed_sets', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from completed_sets x
      union all select 'testing_sessions', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from testing_sessions x
      union all select 'testing_results', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from testing_results x
      union all select 'readiness_entries', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from readiness_entries x
      union all select 'enrollment_pause_events', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from enrollment_pause_events x
      union all select 'exercise_maxes', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from exercise_maxes x
      union all select 'program_versions', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from program_versions x
      union all select 'workout_templates', count(*), md5(string_agg(to_jsonb(x)::text, '' order by x.id)) from workout_templates x
    ) a using (t)
    where a.n <> b.n or a.h is distinct from b.h
  ),
  'workouts, sets, testing, readiness, pause history, maxes and program content are unchanged by restart');

-- 4. Restarting an archived run that was restarted into a now-current run
--    still returns that run; restarting again from the NEW run works.
begin;
select test_act_as('aaaaaaaa-0000-0000-0000-000000000000');
select test_assert(
  (select restarted_from_enrollment_id from restart_program(
     (select id from program_enrollments where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' and status = 'active'),
     '2026-11-02')) is not null,
  'a second, deliberate restart from the new run succeeds');
select test_assert(
  (select count(*) from program_enrollments where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' and status in ('active','paused')) = 1
  and (select count(*) from program_enrollments where user_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 3,
  'after two restarts: one current run, two archived runs');
-- The original run was restarted into a run that is itself now archived.
do $$ begin
  perform restart_program('aaaaaaaa-0000-0000-0000-0000000000e1', '2026-11-02');
  raise exception 'expected CCR04';
exception when sqlstate 'CCR04' then raise notice 'ok - stale run cannot be restarted again (CCR04)';
end $$;
rollback;

-- 5. Validation.
begin;
select test_act_as('bbbbbbbb-0000-0000-0000-000000000000');
do $$ begin
  perform restart_program('bbbbbbbb-0000-0000-0000-0000000000e1', '2026-10-27');
  raise exception 'expected CCR02';
exception when sqlstate 'CCR02' then raise notice 'ok - non-Monday start date rejected (CCR02)';
end $$;
rollback;

-- 6. One user cannot restart (archive) another user's run.
begin;
select test_act_as('bbbbbbbb-0000-0000-0000-000000000000');
do $$ begin
  perform restart_program(
    (select id from program_enrollments where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' and status = 'active'),
    '2026-10-26');
  raise exception 'expected CCR03';
exception when sqlstate 'CCR03' then raise notice 'ok - cannot restart another user''s run (CCR03)';
end $$;
rollback;

-- 7. Unauthenticated callers cannot execute it at all.
begin;
set local role anon;
do $$ begin
  perform restart_program('bbbbbbbb-0000-0000-0000-0000000000e1', '2026-10-26');
  raise exception 'expected permission denied';
exception when insufficient_privilege then raise notice 'ok - anon cannot execute restart_program';
end $$;
rollback;

-- 8. The unique index blocks a second current run even via direct insert.
begin;
select test_act_as('bbbbbbbb-0000-0000-0000-000000000000');
do $$ begin
  insert into program_enrollments (user_id, program_version_id, start_date, status)
  values ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', '2026-10-26', 'active');
  raise exception 'expected unique violation';
exception when unique_violation then raise notice 'ok - second active run rejected by unique index';
end $$;
do $$ begin
  insert into program_enrollments (user_id, program_version_id, start_date, status)
  values ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', '2026-10-26', 'paused');
  raise exception 'expected unique violation';
exception when unique_violation then raise notice 'ok - active + paused run rejected by unique index';
end $$;
rollback;

-- 9. A paused run can be restarted too.
begin;
update program_enrollments set status = 'paused' where id = 'bbbbbbbb-0000-0000-0000-0000000000e1';
select test_act_as('bbbbbbbb-0000-0000-0000-000000000000');
select test_assert(
  (select status::text from restart_program('bbbbbbbb-0000-0000-0000-0000000000e1', '2026-10-26')) = 'active',
  'restarting a paused run creates an active run');
rollback;
