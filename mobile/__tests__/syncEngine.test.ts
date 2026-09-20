/**
 * Offline queue + sync: a row written locally while offline (or in demo
 * mode) is marked pending; `syncPendingWorkoutData` should push every
 * pending row exactly once per successful upsert, mark it synced, leave
 * failed rows pending for the next attempt, and never lose data either way.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Collections, listPending, upsert } from '../src/lib/offline/localWorkoutStore';
import { syncPendingWorkoutData } from '../src/features/workout/syncEngine';

const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

// Hoisted above these imports by babel-plugin-jest-hoist, so syncEngine
// picks up the mocked client module regardless of import order.
jest.mock('../src/lib/supabase/client', () => ({
  requireSupabase: () => ({ from: mockFrom }),
}));

const userId = 'sync-user';

beforeEach(async () => {
  mockUpsert.mockReset();
  mockFrom.mockClear();
  await AsyncStorage.clear();
});

describe('syncPendingWorkoutData', () => {
  it('pushes every pending row and marks it synced on success', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await upsert(userId, Collections.sessions, { id: 'session-1', foo: 'bar' });
    await upsert(userId, Collections.readiness, { id: 'readiness-1', foo: 'baz' });

    const result = await syncPendingWorkoutData(userId);

    expect(result.pushed).toBe(2);
    expect(result.failed).toBe(0);
    expect(await listPending(userId, Collections.sessions)).toHaveLength(0);
    expect(await listPending(userId, Collections.readiness)).toHaveLength(0);
  });

  it('leaves a row pending (never loses it) when its push fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'network error' } });

    await upsert(userId, Collections.sets, { id: 'set-1', foo: 'qux' });

    const result = await syncPendingWorkoutData(userId);

    expect(result.failed).toBe(1);
    const stillPending = await listPending(userId, Collections.sets);
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0]).toMatchObject({ id: 'set-1' });
  });

  it('retrying a push for an already-synced row is a safe no-op (idempotent upsert on id)', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    await upsert(userId, Collections.journal, { id: 'journal-1', content: 'note' });

    await syncPendingWorkoutData(userId); // first push
    const secondResult = await syncPendingWorkoutData(userId); // nothing left pending

    expect(secondResult.pushed).toBe(0);
    expect(mockUpsert).toHaveBeenCalledTimes(1); // only pushed once, not re-pushed
  });
});
