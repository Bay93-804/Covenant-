/**
 * delete-account Edge Function request handling
 * (supabase/functions/delete-account/handler.ts — the exact code index.ts
 * serves). Proves a caller can only ever delete the account their verified
 * token belongs to, and only after a recent sign-in.
 */
import {
  REAUTH_MAX_AGE_SECONDS,
  createDeleteAccountHandler,
  decodeJwtPayload,
  lastAuthenticatedAtFromClaims,
  type DeleteAccountDeps,
} from '../supabase/functions/delete-account/handler';

const NOW = 1_800_000_000;
const USER_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000000';

function makeDeps(overrides: Partial<DeleteAccountDeps> = {}) {
  const tokens: Record<string, { userId: string; lastAuthenticatedAt: number | null }> = {
    'token-a': { userId: USER_A, lastAuthenticatedAt: NOW - 30 },
    'token-a-stale': { userId: USER_A, lastAuthenticatedAt: NOW - REAUTH_MAX_AGE_SECONDS - 1 },
    'token-a-no-amr': { userId: USER_A, lastAuthenticatedAt: null },
  };
  const deps = {
    verifyCaller: jest.fn(async (token: string) => tokens[token] ?? null),
    deleteUserData: jest.fn(async (_userId: string) => {}),
    deleteAuthUser: jest.fn(async (_userId: string) => 'deleted' as const),
    nowSeconds: () => NOW,
    ...overrides,
  };
  return deps;
}

function post(token: string | null, body?: unknown, method = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('https://example.supabase.co/functions/v1/delete-account', {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
}

describe('delete-account handler — authorization', () => {
  it('deletes the verified caller', async () => {
    const deps = makeDeps();
    const res = await createDeleteAccountHandler(deps)(post('token-a'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(deps.deleteUserData).toHaveBeenCalledWith(USER_A);
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(USER_A);
  });

  it('one user cannot delete another user: any user id in the request is ignored', async () => {
    const deps = makeDeps();
    const res = await createDeleteAccountHandler(deps)(
      post('token-a', { userId: USER_B, user_id: USER_B, id: USER_B, sub: USER_B }),
    );

    expect(res.status).toBe(200);
    const targeted = [
      ...(deps.deleteUserData as jest.Mock).mock.calls,
      ...(deps.deleteAuthUser as jest.Mock).mock.calls,
    ].flat();
    expect(targeted).toEqual([USER_A, USER_A]);
    expect(targeted).not.toContain(USER_B);
  });

  it('rejects a forged/invalid token without deleting anything', async () => {
    const deps = makeDeps();
    const res = await createDeleteAccountHandler(deps)(
      post('forged-token-for-b', { userId: USER_B }),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_session' });
    expect(deps.deleteUserData).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('treats a verifier failure as unauthenticated', async () => {
    const deps = makeDeps({ verifyCaller: jest.fn().mockRejectedValue(new Error('auth down')) });
    const res = await createDeleteAccountHandler(deps)(post('token-a'));
    expect(res.status).toBe(401);
    expect(deps.deleteUserData).not.toHaveBeenCalled();
  });

  it('requires an Authorization bearer token', async () => {
    const deps = makeDeps();
    const res = await createDeleteAccountHandler(deps)(post(null, { userId: USER_A }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'missing_authorization' });
    expect(deps.verifyCaller).not.toHaveBeenCalled();
  });

  it('only accepts POST', async () => {
    const deps = makeDeps();
    const res = await createDeleteAccountHandler(deps)(post('token-a', undefined, 'GET'));
    expect(res.status).toBe(405);
    expect(deps.deleteUserData).not.toHaveBeenCalled();
  });
});

describe('delete-account handler — recent authentication', () => {
  it.each(['token-a-stale', 'token-a-no-amr'])(
    'refuses %s (sign-in older than the window, or unknown) with reauthentication_required',
    async (token) => {
      const deps = makeDeps();
      const res = await createDeleteAccountHandler(deps)(post(token));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'reauthentication_required' });
      expect(deps.deleteUserData).not.toHaveBeenCalled();
    },
  );

  it('reads the most recent amr timestamp from verified claims', () => {
    expect(
      lastAuthenticatedAtFromClaims({
        amr: [
          { method: 'password', timestamp: 100 },
          { method: 'otp', timestamp: 300 },
        ],
      }),
    ).toBe(300);
    expect(lastAuthenticatedAtFromClaims({})).toBeNull();
    expect(lastAuthenticatedAtFromClaims(null)).toBeNull();
  });

  it('decodes a base64url JWT payload', () => {
    const payload = { sub: USER_A, amr: [{ method: 'password', timestamp: NOW }] };
    const b64url = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(decodeJwtPayload(`header.${b64url}.signature`)).toEqual(payload);
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });
});

describe('delete-account handler — partial failure', () => {
  it('does not delete the auth user when the data deletion fails', async () => {
    const deps = makeDeps({ deleteUserData: jest.fn().mockRejectedValue(new Error('db down')) });
    const res = await createDeleteAccountHandler(deps)(post('token-a'));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'deletion_failed' });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it('reports failure when the auth delete fails, so the client can retry', async () => {
    const deps = makeDeps({ deleteAuthUser: jest.fn().mockRejectedValue(new Error('admin api')) });
    const res = await createDeleteAccountHandler(deps)(post('token-a'));
    expect(res.status).toBe(500);
  });

  it('a retry after the auth user is already gone still succeeds', async () => {
    const deps = makeDeps({ deleteAuthUser: jest.fn(async () => 'not_found' as const) });
    const res = await createDeleteAccountHandler(deps)(post('token-a'));
    expect(res.status).toBe(200);
  });
});
