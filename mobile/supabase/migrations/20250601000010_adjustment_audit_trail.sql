-- Phase 4 correction: adjusted-workout persistence (Phase 3 defect fix).
--
-- `workout_sessions.status` is completion state only and was never actually
-- being set to 'adjusted' (completeSession always writes 'completed'), so a
-- session that was both completed and safety/pickup-sport-adjusted had no
-- reliable way to be identified as adjusted after the fact. Rather than
-- overload `status` (a single value can't mean two independent facts at
-- once), "was this session adjusted" is now derived by joining
-- `workout_sessions.readiness_entry_id` to `safety_adjustments.readiness_entry_id`
-- for confirmed adjustments — see src/features/workout/sessionAdjustment.ts.
-- This migration only adds the index that join needs and brings
-- `sport_sessions` up to the same audit-trail shape `safety_adjustments`
-- already had (original prescription, resulting prescription, confirmation
-- timestamp) so a confirmed pickup-sport adjustment is equally queryable.

create index if not exists workout_sessions_readiness_entry_id_idx
  on workout_sessions (readiness_entry_id);

create index if not exists safety_adjustments_readiness_entry_id_idx
  on safety_adjustments (readiness_entry_id);

alter table sport_sessions
  add column if not exists confirmed_at timestamptz,
  add column if not exists original_prescription_snapshot jsonb,
  add column if not exists adjusted_prescription_snapshot jsonb;
