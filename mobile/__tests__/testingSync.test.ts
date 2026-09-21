/**
 * Confirms the Phase 4 testing collections (testing_sessions/testing_results)
 * are wired into the same offline sync engine Phase 3 built — demo mode
 * never touches this path (isSupabaseConfigured is false), Supabase mode
 * pushes pending rows exactly like every other collection.
 */
import { Collections, listPending, upsert } from '../src/lib/offline/localWorkoutStore';
import { syncPendingWorkoutData } from '../src/features/workout/syncEngine';

const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

jest.mock('../src/lib/supabase/client', () => ({
  requireSupabase: () => ({ from: mockFrom }),
}));

const userId = 'testing-sync-user';

beforeEach(async () => {
  mockUpsert.mockReset();
  mockFrom.mockClear();
});

describe('syncPendingWorkoutData: testing collections', () => {
  it('pushes pending testing_sessions and testing_results rows and marks them synced', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    await upsert(userId, Collections.testingSessions, { id: 'testing-session-1' });
    await upsert(userId, Collections.testingResults, { id: 'testing-result-1' });

    const result = await syncPendingWorkoutData(userId);

    expect(result.pushed).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockFrom).toHaveBeenCalledWith('testing_sessions');
    expect(mockFrom).toHaveBeenCalledWith('testing_results');
    expect(await listPending(userId, Collections.testingSessions)).toHaveLength(0);
    expect(await listPending(userId, Collections.testingResults)).toHaveLength(0);
  });
});
