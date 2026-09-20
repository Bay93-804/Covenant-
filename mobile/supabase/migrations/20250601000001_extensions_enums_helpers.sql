-- Coach Conde — The Long Game: Athletic Edition
-- Phase 1 design: docs/phase1/DATABASE_SCHEMA.md
-- Extensions, enum types, and the shared updated_at trigger helper.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

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

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
