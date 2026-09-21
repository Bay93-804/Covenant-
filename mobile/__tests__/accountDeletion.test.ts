/**
 * Account deletion (src/lib/accountDeletion/deleteAccount.ts) — the
 * production-review-ready "delete my account" path from app/(tabs)/profile/
 * delete-account.tsx. Demo mode must delete everything locally with no
 * server; Supabase mode must go through the delete-account Edge Function
 * (the client never holds a service-role key — see src/lib/env.ts) and
 * surface a clear, actionable error when that function isn't deployed yet.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- deliberate mid-test require()s, some after jest.doMock/isolateModules, which only take effect on the next require() rather than a top-level import */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { demoSignUp } from '../src/lib/demo/demoAuth';
import { getDemoProfile, upsertDemoProfile } from '../src/lib/demo/demoContentStore';
import { Collections, listAll, upsert } from '../src/lib/offline/localWorkoutStore';

const ORIGINAL_ENV = process.env;

beforeEach(async () => {
  await AsyncStorage.clear();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('deleteAccount — demo mode', () => {
  it('removes the account, its profile data, and its local offline data', async () => {
    const { deleteAccount } = require('../src/lib/accountDeletion/deleteAccount');

    const user = await demoSignUp('athlete@example.com', 'correct-horse-battery-staple');
    await upsertDemoProfile(user.id, { display_name: 'Test Athlete' });
    await upsert(user.id, Collections.sessions, { id: 'session-1' });

    expect(await getDemoProfile(user.id)).not.toBeNull();
    expect(await listAll(user.id, Collections.sessions)).toHaveLength(1);

    await deleteAccount(user.id);

    expect(await getDemoProfile(user.id)).toBeNull();
    expect(await listAll(user.id, Collections.sessions)).toHaveLength(0);

    // The account credentials themselves are gone — signing back in fails.
    const { demoSignIn, DemoAuthError } = require('../src/lib/demo/demoAuth');
    await expect(demoSignIn('athlete@example.com', 'correct-horse-battery-staple')).rejects.toThrow(
      DemoAuthError,
    );
  });

  it('does not touch a second demo account on the same device', async () => {
    const { deleteAccount } = require('../src/lib/accountDeletion/deleteAccount');

    const userA = await demoSignUp('athlete-a@example.com', 'password-a');
    const userB = await demoSignUp('athlete-b@example.com', 'password-b');
    await upsertDemoProfile(userA.id, { display_name: 'Athlete A' });
    await upsertDemoProfile(userB.id, { display_name: 'Athlete B' });

    await deleteAccount(userA.id);

    expect(await getDemoProfile(userA.id)).toBeNull();
    expect(await getDemoProfile(userB.id)).not.toBeNull();

    const { demoSignIn } = require('../src/lib/demo/demoAuth');
    await expect(demoSignIn('athlete-b@example.com', 'password-b')).resolves.toMatchObject({
      email: 'athlete-b@example.com',
    });
  });
});

describe('deleteAccount — Supabase mode', () => {
  it('surfaces a clear error when the delete-account function is not deployed', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(40);

    const mockInvoke = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Function not found' },
    });
    const mockGetSession = jest.fn().mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });

    jest.doMock('../src/lib/supabase/client', () => ({
      supabase: {
        auth: { getSession: mockGetSession, signOut: jest.fn() },
        functions: { invoke: mockInvoke },
      },
    }));

    let deleteAccount: typeof import('../src/lib/accountDeletion/deleteAccount').deleteAccount;
    let AccountDeletionError: typeof import('../src/lib/accountDeletion/deleteAccount').AccountDeletionError;
    jest.isolateModules(() => {
      ({
        deleteAccount,
        AccountDeletionError,
      } = require('../src/lib/accountDeletion/deleteAccount'));
    });

    await expect(deleteAccount!('some-user-id')).rejects.toThrow(AccountDeletionError!);
    expect(mockInvoke).toHaveBeenCalledWith(
      'delete-account',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-123' } }),
    );

    jest.dontMock('../src/lib/supabase/client');
  });
});
