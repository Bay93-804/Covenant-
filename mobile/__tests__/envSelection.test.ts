/**
 * Environment selection: which EAS build profile (`EXPO_PUBLIC_APP_ENV`)
 * decides whether a missing/invalid backend config is allowed to fall back
 * to local demo mode (development/preview) or must hard-stop instead
 * (production) — see src/lib/env.ts and app/_layout.tsx's
 * MisconfiguredProductionScreen.
 *
 * env.ts reads `process.env` at module-load time, so each case here resets
 * the module registry and re-requires it under its own env — this is the
 * standard way to test a module with load-time side effects under Jest.
 */
const ORIGINAL_ENV = process.env;

function loadEnvWith(overrides: Record<string, string | undefined>) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...overrides };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/lib/env');
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('isSupabaseConfigured', () => {
  it('is false with no Supabase env vars set', () => {
    const { isSupabaseConfigured } = loadEnvWith({
      EXPO_PUBLIC_SUPABASE_URL: undefined,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect(isSupabaseConfigured).toBe(false);
  });

  it('is true with a well-formed URL and anon key', () => {
    const { isSupabaseConfigured } = loadEnvWith({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
    });
    expect(isSupabaseConfigured).toBe(true);
  });

  it('is false when the URL is malformed, without crashing', () => {
    const { isSupabaseConfigured } = loadEnvWith({
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
    });
    expect(isSupabaseConfigured).toBe(false);
  });
});

describe('requiresBackend / isMisconfiguredProductionBuild', () => {
  it('defaults to development (does not require a backend) when unset', () => {
    const { env, requiresBackend } = loadEnvWith({ EXPO_PUBLIC_APP_ENV: undefined });
    expect(env.APP_ENV).toBe('development');
    expect(requiresBackend).toBe(false);
  });

  it('does not require a backend for the preview profile', () => {
    const { requiresBackend } = loadEnvWith({ EXPO_PUBLIC_APP_ENV: 'preview' });
    expect(requiresBackend).toBe(false);
  });

  it('requires a backend for the production profile', () => {
    const { requiresBackend } = loadEnvWith({ EXPO_PUBLIC_APP_ENV: 'production' });
    expect(requiresBackend).toBe(true);
  });

  it('a production build with no Supabase config is flagged misconfigured', () => {
    const { isMisconfiguredProductionBuild } = loadEnvWith({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: undefined,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect(isMisconfiguredProductionBuild).toBe(true);
  });

  it('a production build WITH Supabase config is not flagged misconfigured', () => {
    const { isMisconfiguredProductionBuild } = loadEnvWith({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
    });
    expect(isMisconfiguredProductionBuild).toBe(false);
  });

  it('a preview build with no Supabase config is NOT flagged misconfigured (demo mode is allowed)', () => {
    const { isMisconfiguredProductionBuild } = loadEnvWith({
      EXPO_PUBLIC_APP_ENV: 'preview',
      EXPO_PUBLIC_SUPABASE_URL: undefined,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect(isMisconfiguredProductionBuild).toBe(false);
  });
});
