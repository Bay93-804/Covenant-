-- Account data deletion: only service_role may run it, it removes every
-- row the target owns (and nothing anyone else owns), and the auth.users
-- delete that follows cannot be blocked by a foreign key.
\set ON_ERROR_STOP on

-- C is deleted. D is a bystander whose rows reference C's (coach link,
-- a cross-user NO ACTION reference) and must survive intact.
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000000', 'c@example.com'),
  ('dddddddd-0000-0000-0000-000000000000', 'd@example.com');
insert into program_enrollments (id, user_id, program_version_id, start_date, status, archived_at)
values ('cccccccc-0000-0000-0000-0000000000e0', 'cccccccc-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-0000000000a1', '2026-06-01', 'restarted', now());
insert into program_enrollments (id, user_id, program_version_id, start_date, status, restarted_from_enrollment_id)
values ('cccccccc-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-0000000000a1', '2026-09-07', 'active', 'cccccccc-0000-0000-0000-0000000000e0');
insert into program_enrollments (id, user_id, program_version_id, coach_id, start_date, status)
values ('dddddddd-0000-0000-0000-0000000000e1', 'dddddddd-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000000', '2026-09-07', 'active');
select test_seed_history('cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e0', 'c');
select test_seed_history('dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000e1', 'd');
insert into notification_preferences (user_id) values
  ('cccccccc-0000-0000-0000-000000000000'), ('dddddddd-0000-0000-0000-000000000000');
-- D's PR points at C's workout session (FKs don't check ownership).
insert into personal_records (user_id, record_type, reference_key, value_numeric, unit, workout_session_id)
values ('dddddddd-0000-0000-0000-000000000000', 'lift', 'x', 1, 'lb', 'c0000000-0000-0000-0000-000000000001');

create temp table d_before as
select (select count(*) from workout_sessions where user_id = 'dddddddd-0000-0000-0000-000000000000') as sessions,
       (select count(*) from completed_sets where user_id = 'dddddddd-0000-0000-0000-000000000000') as sets,
       (select count(*) from testing_results where user_id = 'dddddddd-0000-0000-0000-000000000000') as results,
       (select count(*) from personal_records where user_id = 'dddddddd-0000-0000-0000-000000000000') as prs,
       (select count(*) from program_enrollments where user_id = 'dddddddd-0000-0000-0000-000000000000') as enrollments,
       (select count(*) from profiles where id = 'dddddddd-0000-0000-0000-000000000000') as profiles;

-- 1. A signed-in user cannot call it — not for another user, not even for themselves.
begin;
select test_act_as('dddddddd-0000-0000-0000-000000000000');
do $$ begin
  perform delete_user_data('cccccccc-0000-0000-0000-000000000000');
  raise exception 'expected permission denied';
exception when insufficient_privilege then raise notice 'ok - authenticated user cannot delete another user''s data';
end $$;
do $$ begin
  perform delete_user_data('dddddddd-0000-0000-0000-000000000000');
  raise exception 'expected permission denied';
exception when insufficient_privilege then raise notice 'ok - authenticated user cannot call delete_user_data directly even for self';
end $$;
rollback;

begin;
set local role anon;
do $$ begin
  perform delete_user_data('cccccccc-0000-0000-0000-000000000000');
  raise exception 'expected permission denied';
exception when insufficient_privilege then raise notice 'ok - anon cannot call delete_user_data';
end $$;
rollback;

-- 2. RLS still keeps D from deleting C's rows through the table API.
begin;
select test_act_as('dddddddd-0000-0000-0000-000000000000');
delete from workout_sessions where user_id = 'cccccccc-0000-0000-0000-000000000000';
delete from program_enrollments where user_id = 'cccccccc-0000-0000-0000-000000000000';
rollback;
select test_assert(
  (select count(*) from workout_sessions where user_id = 'cccccccc-0000-0000-0000-000000000000') = 1
  and (select count(*) from program_enrollments where user_id = 'cccccccc-0000-0000-0000-000000000000') = 2,
  'RLS prevents one user deleting another user''s rows directly');

-- 3. Service role (the Edge Function) deletes C's data, then C's auth user.
begin;
set local role service_role;
select delete_user_data('cccccccc-0000-0000-0000-000000000000');
-- Idempotent: a retry after a partial failure is a harmless no-op.
select delete_user_data('cccccccc-0000-0000-0000-000000000000');
commit;

select test_assert(
  (select count(*) from (
     select user_id from program_enrollments union all
     select user_id from workout_sessions union all
     select user_id from completed_sets union all
     select user_id from readiness_entries union all
     select user_id from safety_adjustments union all
     select user_id from testing_sessions union all
     select user_id from testing_results union all
     select user_id from exercise_maxes union all
     select user_id from personal_records union all
     select user_id from sport_sessions union all
     select user_id from journal_entries union all
     select user_id from enrollment_pause_events union all
     select user_id from notification_preferences union all
     select id from profiles
   ) all_rows where user_id = 'cccccccc-0000-0000-0000-000000000000') = 0,
  'every user-owned row for the deleted user is gone');

select test_assert(
  (select row(sessions, sets, results, prs, enrollments, profiles) from d_before) =
  (select row(
     (select count(*) from workout_sessions where user_id = 'dddddddd-0000-0000-0000-000000000000'),
     (select count(*) from completed_sets where user_id = 'dddddddd-0000-0000-0000-000000000000'),
     (select count(*) from testing_results where user_id = 'dddddddd-0000-0000-0000-000000000000'),
     (select count(*) from personal_records where user_id = 'dddddddd-0000-0000-0000-000000000000'),
     (select count(*) from program_enrollments where user_id = 'dddddddd-0000-0000-0000-000000000000'),
     (select count(*) from profiles where id = 'dddddddd-0000-0000-0000-000000000000'))),
  'the other user''s data is untouched');
select test_assert(
  (select coach_id from program_enrollments where id = 'dddddddd-0000-0000-0000-0000000000e1') is null,
  'the other user''s coach link to the deleted user is cleared, not their enrollment');

delete from auth.users where id = 'cccccccc-0000-0000-0000-000000000000';
select test_assert(
  not exists (select 1 from auth.users where id = 'cccccccc-0000-0000-0000-000000000000'),
  'auth.users delete succeeds after delete_user_data');
