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

import { logger } from './logger';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  // Which EAS build profile produced this binary — 'development' | 'preview'
  // | 'production' (see eas.json). Defaults to 'development' for the Expo
  // Go / local dev-server case, where no profile-specific env is injected.
  // This is the one flag that decides whether a missing backend is allowed
  // to fall back to demo mode (dev/preview) or must hard-stop (production)
  // — see `requiresBackend` below.
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).optional(),
  EXPO_PUBLIC_PRIVACY_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPPORT_URL: z.string().url().optional(),
});

function readRawEnv() {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
    EXPO_PUBLIC_SUPPORT_URL: process.env.EXPO_PUBLIC_SUPPORT_URL,
  };
}

const parsed = envSchema.safeParse(readRawEnv());

if (!parsed.success) {
  // A malformed (not merely absent) env var is a developer mistake worth
  // surfacing loudly in dev — but it must never crash the app, so demo mode
  // still takes over below (unless this is a production build — see
  // `requiresBackend`).
  logger.warn(
    'env',
    'Invalid environment variables — falling back to demo mode.\n' +
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
  );
}

const safeEnv = parsed.success ? parsed.data : {};

export type AppEnv = 'development' | 'preview' | 'production';

export const env = {
  SUPABASE_URL: safeEnv.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: safeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  APP_ENV: (safeEnv.EXPO_PUBLIC_APP_ENV ?? 'development') as AppEnv,
  PRIVACY_URL: safeEnv.EXPO_PUBLIC_PRIVACY_URL,
  SUPPORT_URL: safeEnv.EXPO_PUBLIC_SUPPORT_URL,
};

/**
 * True only when both a Supabase URL and anon key are present and
 * well-formed. This is the single flag the rest of the app checks to
 * decide between the real Supabase backend and local demo mode.
 */
export const isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);

/**
 * True only for the `production` EAS build profile (TestFlight / App Store).
 * A production binary must never silently fall back to local demo mode just
 * because its backend configuration is missing — that would let a real
 * athlete believe their data is being saved to the cloud when it is only
 * ever on-device. `development` and `preview` builds are explicitly allowed
 * to fall back to demo mode (that's the point of the physical-device
 * preview path — see docs/phase5/RELEASE_GUIDE.md).
 */
export const requiresBackend = env.APP_ENV === 'production';

/** True when a production build is missing the backend config it requires. Checked once, at the app root, before anything else renders. */
export const isMisconfiguredProductionBuild = requiresBackend && !isSupabaseConfigured;
