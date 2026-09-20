-- Row-Level Security. docs/phase1/DATABASE_SCHEMA.md §"Row-Level Security"
--
-- Every policy from the approved Phase 1 design is written out explicitly
-- below (rather than "repeat this pattern" comments) so enabling RLS never
-- leaves a table silently inaccessible or, worse, silently open.

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

-- ---------------------------------------------------------------------
-- Program content: readable by any authenticated user, writable only by
-- service_role (a future coach-dashboard writes through a server function,
-- never through client RLS).
-- ---------------------------------------------------------------------

create policy "content readable by authenticated" on program_versions for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on program_weeks for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on program_days for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on workout_templates for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on workout_exercises for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on prescribed_sets for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on am_week_overlays for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on exercise_templates for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on substitutions for select using (auth.role() = 'authenticated');
create policy "content readable by authenticated" on testing_marker_defs for select using (auth.role() = 'authenticated');

create policy "content writable by service role only" on program_versions for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on program_weeks for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on program_days for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on workout_templates for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on workout_exercises for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on prescribed_sets for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on am_week_overlays for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on exercise_templates for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on substitutions for all using (auth.role() = 'service_role');
create policy "content writable by service role only" on testing_marker_defs for all using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- User ownership: user_id = auth.uid(), applied identically to every
-- *_entries / *_sessions / *_sets / *_records / *_adjustments / *_maxes
-- table with a direct user_id column.
-- ---------------------------------------------------------------------

create policy "own rows select" on program_enrollments for select using (user_id = auth.uid());
create policy "own rows insert" on program_enrollments for insert with check (user_id = auth.uid());
create policy "own rows update" on program_enrollments for update using (user_id = auth.uid());
create policy "own rows delete" on program_enrollments for delete using (user_id = auth.uid());

create policy "own rows select" on workout_sessions for select using (user_id = auth.uid());
create policy "own rows insert" on workout_sessions for insert with check (user_id = auth.uid());
create policy "own rows update" on workout_sessions for update using (user_id = auth.uid());
create policy "own rows delete" on workout_sessions for delete using (user_id = auth.uid());

create policy "own rows select" on completed_sets for select using (user_id = auth.uid());
create policy "own rows insert" on completed_sets for insert with check (user_id = auth.uid());
create policy "own rows update" on completed_sets for update using (user_id = auth.uid());
create policy "own rows delete" on completed_sets for delete using (user_id = auth.uid());

create policy "own rows select" on readiness_entries for select using (user_id = auth.uid());
create policy "own rows insert" on readiness_entries for insert with check (user_id = auth.uid());
create policy "own rows update" on readiness_entries for update using (user_id = auth.uid());
create policy "own rows delete" on readiness_entries for delete using (user_id = auth.uid());

create policy "own rows select" on safety_adjustments for select using (user_id = auth.uid());
create policy "own rows insert" on safety_adjustments for insert with check (user_id = auth.uid());
create policy "own rows update" on safety_adjustments for update using (user_id = auth.uid());
create policy "own rows delete" on safety_adjustments for delete using (user_id = auth.uid());

create policy "own rows select" on testing_sessions for select using (user_id = auth.uid());
create policy "own rows insert" on testing_sessions for insert with check (user_id = auth.uid());
create policy "own rows update" on testing_sessions for update using (user_id = auth.uid());
create policy "own rows delete" on testing_sessions for delete using (user_id = auth.uid());

create policy "own rows select" on testing_results for select using (user_id = auth.uid());
create policy "own rows insert" on testing_results for insert with check (user_id = auth.uid());
create policy "own rows update" on testing_results for update using (user_id = auth.uid());
create policy "own rows delete" on testing_results for delete using (user_id = auth.uid());

create policy "own rows select" on exercise_maxes for select using (user_id = auth.uid());
create policy "own rows insert" on exercise_maxes for insert with check (user_id = auth.uid());
create policy "own rows update" on exercise_maxes for update using (user_id = auth.uid());
create policy "own rows delete" on exercise_maxes for delete using (user_id = auth.uid());

create policy "own rows select" on personal_records for select using (user_id = auth.uid());
create policy "own rows insert" on personal_records for insert with check (user_id = auth.uid());
create policy "own rows update" on personal_records for update using (user_id = auth.uid());
create policy "own rows delete" on personal_records for delete using (user_id = auth.uid());

create policy "own rows select" on sport_sessions for select using (user_id = auth.uid());
create policy "own rows insert" on sport_sessions for insert with check (user_id = auth.uid());
create policy "own rows update" on sport_sessions for update using (user_id = auth.uid());
create policy "own rows delete" on sport_sessions for delete using (user_id = auth.uid());

create policy "own rows select" on journal_entries for select using (user_id = auth.uid());
create policy "own rows insert" on journal_entries for insert with check (user_id = auth.uid());
create policy "own rows update" on journal_entries for update using (user_id = auth.uid());
create policy "own rows delete" on journal_entries for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- profiles / notification_preferences: keyed directly on the user id, so
-- ownership is `id = auth.uid()` rather than a separate user_id column.
-- ---------------------------------------------------------------------

create policy "own row select" on profiles for select using (id = auth.uid());
create policy "own row update" on profiles for update using (id = auth.uid());
-- No insert/delete policy: rows are created only by the handle_new_user()
-- trigger (security definer) and cascade-deleted with the auth.users row.

create policy "own row select" on notification_preferences for select using (user_id = auth.uid());
create policy "own row insert" on notification_preferences for insert with check (user_id = auth.uid());
create policy "own row update" on notification_preferences for update using (user_id = auth.uid());
create policy "own row delete" on notification_preferences for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Coach-dashboard readiness (future, inert until a coach role exists).
-- Commented out for MVP, per PRD §6 "explicitly out of scope for MVP".
-- ---------------------------------------------------------------------
-- create policy "coach can read assigned athlete data" on workout_sessions for select
--   using (exists (
--     select 1 from program_enrollments e
--     where e.id = workout_sessions.enrollment_id and e.coach_id = auth.uid()
--   ));
