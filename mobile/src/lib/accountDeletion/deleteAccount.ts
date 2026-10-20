/**
 * Account deletion — the single entry point the "Delete Account" screen
 * (app/(tabs)/profile/delete-account.tsx) calls, for both backends.
 *
 * `deleteAccountWithReauth` is the full flow:
 *  1. Re-authenticate with the password the user just typed. A wrong
 *     password stops here — nothing is deleted.
 *  2. Delete the account:
 *     - Supabase mode: the `delete-account` Edge Function, called with the
 *       fresh access token from step 1. The function verifies that token,
 *       requires the sign-in to be recent (its `amr` timestamp — so a stale
 *       session can't skip step 1), deletes every user-owned row in one
 *       transaction, then the auth user. The client never holds a
 *       service-role key (see src/lib/env.ts).
 *     - Demo mode: local credentials + profile/enrollment/preferences.
 *  3. Only after the server confirms: sign out locally (no network call —
 *     the server session no longer exists) and clear this user's offline
 *     workout/testing store. The screen then clears the React Query cache.
 *
 * Double submission: concurrent calls share one in-flight promise, so a
 * second tap can never start a second deletion.
 */
import { demoDeleteAccount } from '../demo/demoAuth';
import { deleteDemoUserData } from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import { clearAllForUser } from '../offline/localWorkoutStore';
import { supabase } from '../supabase/client';

export type AccountDeletionErrorCode =
  'reauth_failed' | 'reauth_required' | 'session_expired' | 'not_deployed' | 'network' | 'server';

export class AccountDeletionError extends Error {
  constructor(
    readonly code: AccountDeletionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface FunctionErrorBody {
  error?: string;
  message?: string;
}

async function readFunctionErrorBody(error: unknown): Promise<FunctionErrorBody | null> {
  // FunctionsHttpError carries the raw Response as `context`.
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof (context as Response).json !== 'function') return null;
  try {
    return (await (context as Response).clone().json()) as FunctionErrorBody;
  } catch {
    return null;
  }
}

async function toDeletionError(error: unknown): Promise<AccountDeletionError> {
  const name = (error as { name?: string } | null)?.name;
  const status = (error as { context?: { status?: number } } | null)?.context?.status;

  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError') {
    return new AccountDeletionError(
      'network',
      'Couldn’t reach the server. Check your connection and try again — nothing was deleted.',
    );
  }

  const body = await readFunctionErrorBody(error);
  switch (body?.error) {
    case 'reauthentication_required':
      return new AccountDeletionError(
        'reauth_required',
        body.message ?? 'Re-enter your password and try again.',
      );
    case 'invalid_session':
    case 'missing_authorization':
      return new AccountDeletionError(
        'session_expired',
        'Your session has expired. Sign in again, then retry.',
      );
    case 'deletion_failed':
      return new AccountDeletionError(
        'server',
        body.message ?? 'Deletion failed on the server. Please try again.',
      );
  }

  if (status === 404) {
    return new AccountDeletionError(
      'not_deployed',
      'Account deletion isn’t available on this server yet (the delete-account function is not deployed). Contact support.',
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new AccountDeletionError(
    'server',
    `Account deletion failed. Please try again. (${detail})`,
  );
}

async function deleteSupabaseAccount(): Promise<void> {
  if (!supabase) throw new AccountDeletionError('server', 'Supabase is not configured.');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new AccountDeletionError(
      'session_expired',
      'Your session has expired. Sign in again, then retry.',
    );
  }

  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    result = await supabase.functions.invoke('delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (e) {
    throw await toDeletionError(e);
  }
  if (result.error) throw await toDeletionError(result.error);

  // The account (and with it every server session) is gone. A local-scope
  // sign-out removes the stored session without a network call that would
  // only fail against a deleted user.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

/** Deletes the account for an already re-authenticated user and clears this device's copy of their data. */
export async function deleteAccount(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    await deleteSupabaseAccount();
  } else {
    await demoDeleteAccount(userId);
    await deleteDemoUserData(userId);
  }

  // Offline workout/testing store — both modes write there (see
  // src/lib/offline/localWorkoutStore.ts).
  await clearAllForUser(userId);
}

export interface DeleteAccountWithReauthInput {
  userId: string;
  email: string;
  password: string;
  /** Throws when the password is wrong (AuthContext.signIn). */
  reauthenticate: (email: string, password: string) => Promise<void>;
}

let deletionInFlight: Promise<void> | null = null;

export function deleteAccountWithReauth(input: DeleteAccountWithReauthInput): Promise<void> {
  if (deletionInFlight) return deletionInFlight;

  deletionInFlight = (async () => {
    try {
      await input.reauthenticate(input.email, input.password);
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      const message = e instanceof Error ? e.message : '';
      if (name === 'AuthRetryableFetchError' || /network|fetch/i.test(message)) {
        throw new AccountDeletionError(
          'network',
          'Couldn’t reach the server to verify your password. Check your connection — nothing was deleted.',
        );
      }
      throw new AccountDeletionError(
        'reauth_failed',
        'That password is incorrect. Nothing was deleted.',
      );
    }
    await deleteAccount(input.userId);
  })().finally(() => {
    deletionInFlight = null;
  });

  return deletionInFlight;
}
