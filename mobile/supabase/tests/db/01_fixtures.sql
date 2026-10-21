-- Shared fixtures + helpers for the SQL tests (local harness only).

insert into program_versions (id, slug, title, edition, content_json)
values ('00000000-0000-0000-0000-0000000000a1', 'test-program', 'Test Program', 'test', '{}'::jsonb);

-- Act as a signed-in user for the rest of the current transaction.
create function test_act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

create function test_assert(p_ok boolean, p_message text) returns void language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
  raise notice 'ok - %', p_message;
end $$;

grant execute on function test_act_as(uuid) to public;
grant execute on function test_assert(boolean, text) to public;

insert into program_weeks (id, program_version_id, week_number)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 1);
insert into program_days (id, program_week_id, day_of_week, label)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 0, 'Monday');
insert into workout_templates (id, program_day_id, session_slot, session_type, title)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'pm', 'pm_strength_a', 'Strength A');
insert into exercise_templates (id, program_version_id, name)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Trap Bar Deadlift');
insert into workout_exercises (id, workout_template_id, exercise_template_id, cluster_id, slot_order, rounds, sort_index)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'A', 'A1', 3, 1);

-- Seeds one full program run's worth of history for p_user under
-- p_enrollment (one of every user-owned row type, cross-linked the way the
-- app links them). Runs as the table owner.
create function test_seed_history(p_user uuid, p_enrollment uuid, p_prefix text) returns void
language plpgsql as $$
declare
  v_session uuid := (p_prefix || '0000000-0000-0000-0000-000000000001')::uuid;
  v_set uuid := (p_prefix || '0000000-0000-0000-0000-000000000002')::uuid;
  v_readiness uuid := (p_prefix || '0000000-0000-0000-0000-000000000003')::uuid;
  v_tsession uuid := (p_prefix || '0000000-0000-0000-0000-000000000004')::uuid;
  v_tresult uuid := (p_prefix || '0000000-0000-0000-0000-000000000005')::uuid;
begin
  insert into readiness_entries (id, user_id, entry_date, sleep_hours)
  values (v_readiness, p_user, '2026-09-07', 7.5);
  insert into workout_sessions (id, enrollment_id, user_id, program_day_id, workout_template_id,
                                scheduled_date, session_slot, status, readiness_entry_id, completed_at)
  values (v_session, p_enrollment, p_user, '00000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-0000000000d1', '2026-09-07', 'pm', 'completed', v_readiness,
          '2026-09-07T18:00:00Z');
  insert into completed_sets (id, workout_session_id, workout_exercise_id, user_id, set_number, weight, reps)
  values (v_set, v_session, '00000000-0000-0000-0000-0000000000f1', p_user, 1, 225, 5);
  insert into safety_adjustments (user_id, workout_session_id, readiness_entry_id, trigger_code, reason, recommended_adjustment)
  values (p_user, v_session, v_readiness, 'SLEEP_UNDER_6H', 'r', 'a');
  insert into testing_sessions (id, user_id, enrollment_id, event_key, completed_at)
  values (v_tsession, p_user, p_enrollment, 'week0', '2026-09-05T12:00:00Z');
  insert into testing_results (id, testing_session_id, user_id, marker_number, value_numeric)
  values (v_tresult, v_tsession, p_user, 1, 42);
  insert into exercise_maxes (user_id, lift_key, estimated_1rm, workout_session_id, testing_session_id)
  values (p_user, 'trap_bar_deadlift', 300, v_session, v_tsession);
  insert into personal_records (user_id, record_type, reference_key, value_numeric, unit, workout_session_id, testing_result_id)
  values (p_user, 'lift', 'trap_bar_deadlift', 225, 'lb', v_session, v_tresult);
  insert into sport_sessions (user_id, played_on, sport, affected_workout_session_id)
  values (p_user, '2026-09-08', 'basketball', v_session);
  insert into journal_entries (user_id, level, workout_session_id, completed_set_id, content)
  values (p_user, 'set', v_session, v_set, 'felt good');
  insert into enrollment_pause_events (enrollment_id, user_id, paused_at, resumed_at)
  values (p_enrollment, p_user, '2026-09-10T00:00:00Z', '2026-09-12T00:00:00Z');
end $$;
