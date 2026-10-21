-- Account deletion: remove every row a user owns in one transaction, before
-- the delete-account Edge Function deletes the auth.users row itself.
--
-- Why not rely on `auth.users ... on delete cascade` alone: several
-- user-owned tables reference each other with NO ACTION foreign keys
-- (exercise_maxes -> workout_sessions/testing_sessions, personal_records ->
-- workout_sessions/testing_results, sport_sessions -> workout_sessions,
-- journal_entries -> completed_sets, safety_adjustments -> readiness_entries),
-- and program_enrollments.coach_id references auth.users with no cascade.
-- Deleting children-first in an explicit order, and detaching any reference
-- another user's row holds to this user's rows, makes the auth delete that
-- follows a no-op cascade that cannot fail on an FK.
--
-- Callable only by service_role (the Edge Function). The user id comes from
-- the Edge Function's verified JWT, never from client input.

create or replace function public.delete_user_data(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delete_user_data:' || p_user_id::text, 0));

  -- Detach NO ACTION references pointing at this user's rows (from any
  -- user's rows, including their own) so the deletes below can't be blocked.
  update exercise_maxes set workout_session_id = null
  where workout_session_id in (select id from workout_sessions where user_id = p_user_id);
  update exercise_maxes set testing_session_id = null
  where testing_session_id in (select id from testing_sessions where user_id = p_user_id);
  update personal_records set workout_session_id = null
  where workout_session_id in (select id from workout_sessions where user_id = p_user_id);
  update personal_records set testing_result_id = null
  where testing_result_id in (select id from testing_results where user_id = p_user_id);
  update sport_sessions set affected_workout_session_id = null
  where affected_workout_session_id in (select id from workout_sessions where user_id = p_user_id);
  update journal_entries set completed_set_id = null
  where completed_set_id in (select id from completed_sets where user_id = p_user_id);
  update safety_adjustments set readiness_entry_id = null
  where readiness_entry_id in (select id from readiness_entries where user_id = p_user_id);
  update program_enrollments set restarted_from_enrollment_id = null
  where restarted_from_enrollment_id in (select id from program_enrollments where user_id = p_user_id)
    and user_id <> p_user_id;
  update program_enrollments set coach_id = null
  where coach_id = p_user_id
    and user_id <> p_user_id;

  delete from journal_entries where user_id = p_user_id;
  delete from personal_records where user_id = p_user_id;
  delete from exercise_maxes where user_id = p_user_id;
  delete from sport_sessions where user_id = p_user_id;
  delete from safety_adjustments where user_id = p_user_id;
  delete from completed_sets where user_id = p_user_id;
  delete from testing_results where user_id = p_user_id;
  delete from testing_sessions where user_id = p_user_id;
  delete from readiness_entries where user_id = p_user_id;
  delete from workout_sessions where user_id = p_user_id;
  delete from enrollment_pause_events where user_id = p_user_id;
  delete from program_enrollments where user_id = p_user_id;
  delete from notification_preferences where user_id = p_user_id;
  delete from profiles where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_data(uuid) from public;
revoke all on function public.delete_user_data(uuid) from anon;
revoke all on function public.delete_user_data(uuid) from authenticated;
grant execute on function public.delete_user_data(uuid) to service_role;
