import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { env, isSupabaseConfigured } from '../env';
import type { Database } from './database.types';
import { secureSessionStorage } from './secureSessionStorage';

/**
 * The single Supabase client for the app. Only created when
 * `isSupabaseConfigured` is true — every caller must check that flag (or go
 * through `src/lib/auth`, which already does) before touching this, since
 * it is `null` in local demo mode.
 *
 * Session persistence uses `secureSessionStorage` — AsyncStorage-backed
 * (auth sessions/refresh tokens are larger than SecureStore's per-item size
 * limit comfortably allows for, so the token itself can't live directly in
 * SecureStore) but AES-encrypted with a key that *does* live in
 * `expo-secure-store`, so nothing sensitive is ever written to disk in
 * plaintext. See secureSessionStorage.ts for the full rationale.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Throws with a clear message if called in demo mode — use only where a caller has already checked `isSupabaseConfigured`. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. This code path must not run in local demo mode — check isSupabaseConfigured first.',
    );
  }
  return supabase;
}
