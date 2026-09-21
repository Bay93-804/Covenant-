/**
 * Background sync: pushes locally-queued workout instance data to Supabase
 * when it's configured, and is a no-op in demo mode. Every push is an
 * `upsert(...).on_conflict('id')` — since every row's `id` is generated
 * on-device at creation time (see localWorkoutStore.ts), a retried or
 * duplicated push can never create a duplicate row or silently overwrite a
 * *different* row; the worst case is re-writing the same row with the same
 * values, which is safe.
 *
 * This never *pulls* and merges remote edits over local ones — there is
 * exactly one writer (this device, this athlete) for all of this data per
 * docs/phase1/PRD.md's single-athlete-per-install scope, so the only
 * "conflict" that can occur is a partially-pushed batch after a dropped
 * connection, which resumes cleanly because each row is pushed and marked
 * synced independently.
 */
import { requireSupabase } from '../../lib/supabase/client';
import { logger } from '../../lib/logger';
import {
  Collections,
  listPending,
  markSynced,
  type CollectionName,
} from '../../lib/offline/localWorkoutStore';

type TableName =
  | 'workout_sessions'
  | 'completed_sets'
  | 'readiness_entries'
  | 'safety_adjustments'
  | 'sport_sessions'
  | 'journal_entries'
  | 'exercise_maxes'
  | 'personal_records'
  | 'enrollment_pause_events'
  | 'testing_sessions'
  | 'testing_results';

const COLLECTION_TO_TABLE: Record<CollectionName, TableName> = {
  [Collections.sessions]: 'workout_sessions',
  [Collections.sets]: 'completed_sets',
  [Collections.readiness]: 'readiness_entries',
  [Collections.safetyAdjustments]: 'safety_adjustments',
  [Collections.sportSessions]: 'sport_sessions',
  [Collections.journal]: 'journal_entries',
  [Collections.exerciseMaxes]: 'exercise_maxes',
  [Collections.personalRecords]: 'personal_records',
  [Collections.pauseEvents]: 'enrollment_pause_events',
  [Collections.testingSessions]: 'testing_sessions',
  [Collections.testingResults]: 'testing_results',
};

let syncInFlight: Promise<void> | null = null;
const pendingUsers = new Set<string>();

/** Fire-and-forget trigger, safe to call after every local write — coalesces bursts into one pass. */
export function queueBackgroundSync(userId: string): void {
  pendingUsers.add(userId);
  if (syncInFlight) return;
  syncInFlight = runQueuedSyncs().finally(() => {
    syncInFlight = null;
  });
}

async function runQueuedSyncs(): Promise<void> {
  // Drain one user at a time; new users added mid-run are picked up because
  // the for..of iterates a live Set snapshot taken just before each pass.
  while (pendingUsers.size > 0) {
    const users = Array.from(pendingUsers);
    pendingUsers.clear();
    for (const userId of users) {
      await syncPendingWorkoutData(userId).catch((error) => {
        // Never let a network/auth failure crash the app — it just stays
        // queued locally and is retried on the next write or app foreground.
        logger.warn('sync', `failed for user ${userId}, will retry later`, error);
      });
    }
  }
}

/** Pushes every pending row for `userId` across every collection. Safe to call repeatedly (e.g. on app foreground, pull-to-refresh, or a manual "sync now"). */
export async function syncPendingWorkoutData(
  userId: string,
): Promise<{ pushed: number; failed: number }> {
  const supabase = requireSupabase();
  let pushed = 0;
  let failed = 0;

  for (const collection of Object.values(Collections)) {
    const table = COLLECTION_TO_TABLE[collection];
    const pending = await listPending<{ id: string }>(userId, collection);
    if (pending.length === 0) continue;

    for (const row of pending) {
      const { error } = await supabase
        .from(table as never)
        .upsert(row as never, { onConflict: 'id' });
      if (error) {
        failed += 1;
        logger.warn('sync', `upsert failed for ${table}/${row.id}`, error.message);
        continue;
      }
      await markSynced(userId, collection, row.id);
      pushed += 1;
    }
  }

  return { pushed, failed };
}
