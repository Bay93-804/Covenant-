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

describe('deleteAccountWithReauth — Supabase mode', () => {
  const userId = 'supabase-user-1';

  function httpError(status: number, body: unknown) {
    return {
      name: 'FunctionsHttpError',
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify(body), { status }),
    };
  }

  function load(invokeResult: unknown | (() => Promise<unknown>)) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(40);

    const mockInvoke = jest.fn(
      typeof invokeResult === 'function'
        ? (invokeResult as () => Promise<unknown>)
        : async () => invokeResult,
    );
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    const mockGetSession = jest.fn().mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
    });
    jest.doMock('../src/lib/supabase/client', () => ({
      supabase: {
        auth: { getSession: mockGetSession, signOut: mockSignOut },
        functions: { invoke: mockInvoke },
      },
    }));

    let mod: typeof import('../src/lib/accountDeletion/deleteAccount');
    let store: typeof import('../src/lib/offline/localWorkoutStore');
    jest.isolateModules(() => {
      mod = require('../src/lib/accountDeletion/deleteAccount');
      store = require('../src/lib/offline/localWorkoutStore');
    });
    return { mod: mod!, store: store!, mockInvoke, mockSignOut };
  }

  afterEach(() => jest.dontMock('../src/lib/supabase/client'));

  it('re-authenticates, calls the Edge Function with the caller token, then signs out locally and clears device data', async () => {
    const { mod, store, mockInvoke, mockSignOut } = load({ data: { success: true }, error: null });
    await store.upsert(userId, store.Collections.sessions, { id: 'session-1' });
    const reauthenticate = jest.fn().mockResolvedValue(undefined);

    await mod.deleteAccountWithReauth({
      userId,
      email: 'athlete@example.com',
      password: 'correct',
      reauthenticate,
    });

    expect(reauthenticate).toHaveBeenCalledWith('athlete@example.com', 'correct');
    expect(reauthenticate.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvoke.mock.invocationCallOrder[0]!,
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      'delete-account',
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer fresh-token' } }),
    );
    // No user id is ever sent — the server derives it from the verified token.
    expect(JSON.stringify(mockInvoke.mock.calls[0])).not.toContain(userId);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(await store.listAll(userId, store.Collections.sessions)).toHaveLength(0);
  });

  it('a failed re-authentication deletes nothing and keeps the user signed in', async () => {
    const { mod, store, mockInvoke, mockSignOut } = load({ data: { success: true }, error: null });
    await store.upsert(userId, store.Collections.sessions, { id: 'session-1' });

    await expect(
      mod.deleteAccountWithReauth({
        userId,
        email: 'athlete@example.com',
        password: 'wrong',
        reauthenticate: jest.fn().mockRejectedValue(new Error('Invalid login credentials')),
      }),
    ).rejects.toMatchObject({ code: 'reauth_failed' });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(await store.listAll(userId, store.Collections.sessions)).toHaveLength(1);
  });

  it('double submission starts only one deletion', async () => {
    let finish!: (v: unknown) => void;
    const { mod, mockInvoke } = load(() => new Promise((r) => (finish = r)));
    const reauthenticate = jest.fn().mockResolvedValue(undefined);
    const input = { userId, email: 'athlete@example.com', password: 'correct', reauthenticate };

    const first = mod.deleteAccountWithReauth(input);
    const second = mod.deleteAccountWithReauth(input);
    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    finish({ data: { success: true }, error: null });
    await Promise.all([first, second]);

    expect(reauthenticate).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      httpError(403, { error: 'reauthentication_required', message: 'Re-enter your password.' }),
      'reauth_required',
    ],
    [httpError(401, { error: 'invalid_session' }), 'session_expired'],
    [httpError(500, { error: 'deletion_failed', message: 'try again' }), 'server'],
    [httpError(404, {}), 'not_deployed'],
    [{ name: 'FunctionsFetchError', message: 'Failed to send a request' }, 'network'],
  ])(
    'a server failure (%#) surfaces as %s and leaves the session and device data intact',
    async (error, code) => {
      const { mod, store, mockSignOut } = load({ data: null, error });
      await store.upsert(userId, store.Collections.sessions, { id: 'session-1' });

      await expect(
        mod.deleteAccountWithReauth({
          userId,
          email: 'athlete@example.com',
          password: 'correct',
          reauthenticate: jest.fn().mockResolvedValue(undefined),
        }),
      ).rejects.toMatchObject({ code });

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(await store.listAll(userId, store.Collections.sessions)).toHaveLength(1);
    },
  );

  it('can be retried after a failure', async () => {
    const results = [
      { data: null, error: { name: 'FunctionsFetchError', message: 'offline' } },
      { data: { success: true }, error: null },
    ];
    const { mod, mockInvoke, mockSignOut } = load(async () => results.shift());
    const input = {
      userId,
      email: 'athlete@example.com',
      password: 'correct',
      reauthenticate: jest.fn().mockResolvedValue(undefined),
    };

    await expect(mod.deleteAccountWithReauth(input)).rejects.toMatchObject({ code: 'network' });
    await expect(mod.deleteAccountWithReauth(input)).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
