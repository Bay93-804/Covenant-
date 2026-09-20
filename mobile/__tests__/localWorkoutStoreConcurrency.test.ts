/**
 * `upsert` is read-modify-write over a whole collection array. Firing
 * several upserts to the SAME collection concurrently (e.g. one readiness
 * submission creating multiple safety_adjustments via `Promise.all`) must
 * never let a later write's stale read clobber an earlier write's row.
 */
import { Collections, listAll, upsert } from '../src/lib/offline/localWorkoutStore';

const userId = 'concurrency-user';

describe('localWorkoutStore concurrency', () => {
  it('does not lose a row when two upserts to the same collection run concurrently', async () => {
    await Promise.all([
      upsert(userId, Collections.safetyAdjustments, { id: 'adj-1', reason: 'sleep' }),
      upsert(userId, Collections.safetyAdjustments, { id: 'adj-2', reason: 'calf' }),
    ]);

    const rows = await listAll(userId, Collections.safetyAdjustments);
    expect(rows.map((r: any) => r.id).sort()).toEqual(['adj-1', 'adj-2']);
  });

  it('preserves all rows under a larger concurrent burst', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        upsert(userId, Collections.journal, { id: `entry-${i}`, content: `n${i}` }),
      ),
    );

    const rows = await listAll(userId, Collections.journal);
    expect(rows).toHaveLength(10);
  });
});
