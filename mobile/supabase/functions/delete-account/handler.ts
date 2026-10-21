// Request handling for the delete-account Edge Function, kept free of
// Deno/jsr imports so the exact same code is unit-tested under Jest
// (__tests__/deleteAccountHandler.test.ts). index.ts wires in the real
// Supabase clients.
//
// Security model:
//  - The ONLY identity this function acts on is the one proven by the
//    caller's own access token (verified against Supabase Auth). There is no
//    user-id parameter; anything in the request body is ignored.
//  - Recent authentication is enforced server-side: the token's `amr` claim
//    must show a sign-in within REAUTH_MAX_AGE_SECONDS. Token refreshes keep
//    the original `amr` timestamp, so a long-lived session cannot skip the
//    in-app password re-entry.
//  - App data is deleted in one transaction (public.delete_user_data), then
//    the auth user. If the auth delete fails, a retry is safe: the data step
//    is idempotent and the user can still sign in to retry.

export const REAUTH_MAX_AGE_SECONDS = 10 * 60;

export interface VerifiedCaller {
  userId: string;
  /** Unix seconds of the most recent authentication event in the token's `amr` claim, or null if absent. */
  lastAuthenticatedAt: number | null;
}

export interface DeleteAccountDeps {
  /** Verifies the bearer token with Supabase Auth; null when invalid/expired/revoked. */
  verifyCaller(accessToken: string): Promise<VerifiedCaller | null>;
  deleteUserData(userId: string): Promise<void>;
  /** Deletes the auth.users row. Resolves `'not_found'` when it's already gone. */
  deleteAuthUser(userId: string): Promise<'deleted' | 'not_found'>;
  nowSeconds(): number;
  logError?(message: string, detail?: unknown): void;
}

export type DeleteAccountErrorCode =
  | 'method_not_allowed'
  | 'missing_authorization'
  | 'invalid_session'
  | 'reauthentication_required'
  | 'deletion_failed';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, error: DeleteAccountErrorCode, message: string): Response {
  return json(status, { error, message });
}

/** Extracts the most recent `amr[].timestamp` from an (already verified) JWT payload. */
export function lastAuthenticatedAtFromClaims(claims: unknown): number | null {
  const amr = (claims as { amr?: unknown } | null)?.amr;
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    const ts = (entry as { timestamp?: unknown } | null)?.timestamp;
    if (typeof ts === 'number' && Number.isFinite(ts) && (latest === null || ts > latest)) {
      latest = ts;
    }
  }
  return latest;
}

/** Decodes a JWT's payload segment. Only call on a token Supabase Auth has already verified. */
export function decodeJwtPayload(token: string): unknown {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function createDeleteAccountHandler(deps: DeleteAccountDeps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return fail(405, 'method_not_allowed', 'Method not allowed.');
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match) {
      return fail(401, 'missing_authorization', 'Missing Authorization header.');
    }

    let caller: VerifiedCaller | null;
    try {
      caller = await deps.verifyCaller(match[1]!.trim());
    } catch (e) {
      deps.logError?.('verifyCaller threw', e);
      caller = null;
    }
    if (!caller) {
      return fail(401, 'invalid_session', 'Your session is invalid or has expired. Sign in again.');
    }

    const authAge =
      caller.lastAuthenticatedAt === null ? null : deps.nowSeconds() - caller.lastAuthenticatedAt;
    if (authAge === null || authAge > REAUTH_MAX_AGE_SECONDS) {
      return fail(
        403,
        'reauthentication_required',
        'For your security, re-enter your password and try again.',
      );
    }

    try {
      await deps.deleteUserData(caller.userId);
    } catch (e) {
      deps.logError?.('delete_user_data failed', e);
      return fail(
        500,
        'deletion_failed',
        'We could not delete your data. Nothing was removed — please try again.',
      );
    }

    try {
      await deps.deleteAuthUser(caller.userId);
    } catch (e) {
      deps.logError?.('auth.admin.deleteUser failed', e);
      return fail(
        500,
        'deletion_failed',
        'Your data was deleted but your sign-in could not be removed. Please try again.',
      );
    }

    return json(200, { success: true });
  };
}
