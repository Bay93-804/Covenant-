/**
 * Account deletion — the single entry point both the demo-mode and
 * Supabase-mode "Delete Account" flows call (see
 * app/(tabs)/profile/delete-account.tsx). Reauthentication happens in the
 * screen (the user re-enters their password immediately before calling
 * this), not here — this module assumes the caller has already confirmed
 * it's really the account owner asking.
 *
 * What "delete" means, by mode:
 *  - Demo mode: removes the local account credentials
 *    (src/lib/demo/demoAuth.ts), profile/enrollment/preferences/maxes
 *    (src/lib/demo/demoContentStore.ts), and every locally-stored
 *    workout/testing row for this user
 *    (src/lib/offline/localWorkoutStore.ts) — since demo mode has no
 *    server, this *is* the complete deletion.
 *  - Supabase mode: invokes the `delete-account` Edge Function (see
 *    supabase/functions/delete-account/), which deletes the user's
 *    `auth.users` row — every user-owned table cascades from that FK (see
 *    every `references auth.users(id) on delete cascade` in
 *    supabase/migrations/), so this one server-side delete is the complete
 *    cloud deletion. The client never holds a service-role key (see
 *    src/lib/env.ts) so it cannot perform this delete itself — the Edge
 *    Function is the only privileged path, and it is not deployed by
 *    default (see docs/phase5/RELEASE_GUIDE.md).
 *
 * In both modes, this also clears local SecureStore/AsyncStorage for the
 * account and clears the React Query cache, so nothing about the deleted
 * account is visible on this device afterward.
 */
import { demoDeleteAccount } from '../demo/demoAuth';
import { deleteDemoUserData } from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import { clearAllForUser } from '../offline/localWorkoutStore';
import { supabase } from '../supabase/client';

export class AccountDeletionError extends Error {}

async function deleteSupabaseAccount(userId: string): Promise<void> {
  if (!supabase) throw new AccountDeletionError('Supabase is not configured.');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new AccountDeletionError('Your session has expired. Sign in again and retry.');
  }

  const { data, error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    throw new AccountDeletionError(
      'Account deletion is not available yet — the delete-account server function has not been ' +
        'deployed for this project. See docs/phase5/RELEASE_GUIDE.md. ' +
        `(${error.message})`,
    );
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new AccountDeletionError(String(data.error));
  }

  // The server-side delete already invalidated every session for this
  // user; sign out locally too so client state (in-memory + AsyncStorage
  // token cache) doesn't keep believing there's a live session.
  await supabase.auth.signOut().catch(() => {});
}

export async function deleteAccount(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    await deleteSupabaseAccount(userId);
  } else {
    await demoDeleteAccount(userId);
    await deleteDemoUserData(userId);
  }

  // Every mode's offline workout/testing store is cleared regardless —
  // Supabase mode wrote there too (offline-first — see
  // src/lib/offline/localWorkoutStore.ts's header comment).
  await clearAllForUser(userId);
}
