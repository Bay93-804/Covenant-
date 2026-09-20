/**
 * Environment-variable validation.
 *
 * Only `EXPO_PUBLIC_*` vars are readable in the client bundle (Expo inlines
 * them at build time) — this is exactly why the service-role key must never
 * be defined with that prefix, and why this file has no code path that
 * could read one. If Supabase env vars are absent or invalid, the app is
 * not broken: `isSupabaseConfigured` is false and the app falls back to
 * local demo mode (see src/lib/demo/).
 */
import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
});

function readRawEnv() {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

const parsed = envSchema.safeParse(readRawEnv());

if (!parsed.success) {
  // A malformed (not merely absent) env var is a developer mistake worth
  // surfacing loudly in dev — but it must never crash the app, so demo mode
  // still takes over below.
  console.warn(
    '[env] Invalid Supabase environment variables — falling back to demo mode.\n' +
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
}

const safeEnv = parsed.success ? parsed.data : {};

export const env = {
  SUPABASE_URL: safeEnv.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: safeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

/**
 * True only when both a Supabase URL and anon key are present and
 * well-formed. This is the single flag the rest of the app checks to
 * decide between the real Supabase backend and local demo mode.
 */
export const isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
