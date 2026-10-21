// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user: every row they own (via the
// public.delete_user_data SQL function, one transaction — see
// supabase/migrations/20261020000002_account_data_deletion.sql), then their
// auth.users row (Admin API).
//
// The service-role key exists only here, in the Edge Function runtime's
// built-in SUPABASE_SERVICE_ROLE_KEY env var — never in the mobile app or
// git. SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by Supabase; no `supabase secrets set` is needed.
//
// Deploy with JWT verification left ON (the default — do not pass
// --no-verify-jwt). See docs/phase5/RELEASE_GUIDE.md §9.
//
// All request logic (auth checks, recent-auth window, error mapping) lives
// in ./handler.ts so it can be unit-tested without Deno.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  createDeleteAccountHandler,
  decodeJwtPayload,
  lastAuthenticatedAtFromClaims,
} from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createDeleteAccountHandler({
    async verifyCaller(accessToken) {
      // getUser(jwt) asks Supabase Auth to validate the token (signature,
      // expiry, and that the user/session still exists) — a genuine
      // verification, not a self-reported id.
      const { data, error } = await anonClient.auth.getUser(accessToken);
      if (error || !data.user) return null;
      const claims = decodeJwtPayload(accessToken) as { sub?: string } | null;
      if (!claims || claims.sub !== data.user.id) return null;
      return { userId: data.user.id, lastAuthenticatedAt: lastAuthenticatedAtFromClaims(claims) };
    },
    async deleteUserData(userId) {
      const { error } = await adminClient.rpc('delete_user_data', { p_user_id: userId });
      if (error) throw error;
    },
    async deleteAuthUser(userId) {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (!error) return 'deleted';
      if (error.status === 404) return 'not_found';
      throw error;
    },
    nowSeconds: () => Math.floor(Date.now() / 1000),
    logError: (message, detail) => console.error(`[delete-account] ${message}`, detail),
  }),
);
