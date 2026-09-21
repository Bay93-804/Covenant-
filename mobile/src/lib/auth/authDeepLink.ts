/**
 * Handles the app being opened from a Supabase auth email link — password
 * reset today, and (if email confirmation is ever turned on in the Supabase
 * project's Auth settings) sign-up confirmation, via the same mechanism.
 *
 * Supabase's email templates link to `{SITE_URL}` (or, when `redirectTo` is
 * passed, that URL) with the session tokens attached as a URL fragment
 * (`#access_token=...&refresh_token=...&type=recovery`) or, for some flows,
 * as query params. `requestPasswordReset` (AuthContext.tsx) passes
 * `Linking.createURL('reset-password')` — i.e. `coachconde://reset-password`
 * in a standalone/TestFlight build, or an Expo-Go-compatible exp:// URL in
 * dev — as `redirectTo`, so opening that link always reopens this app
 * (never a browser) directly at the right screen.
 *
 * `detectSessionInUrl` is `false` on the Supabase client (see
 * src/lib/supabase/client.ts) because that option only knows how to parse a
 * *browser* `window.location` — on native there is no such thing, so this
 * module does the equivalent by hand: parse the incoming URL, and if it
 * carries a recovery session, call `supabase.auth.setSession` directly.
 *
 * No-ops entirely in demo mode (there is no email, no deep-linked recovery
 * flow — see `demoRequestPasswordReset`).
 */
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { isSupabaseConfigured } from '../env';
import { supabase } from '../supabase/client';
import { logger } from '../logger';

export function passwordResetRedirectUrl(): string {
  return Linking.createURL('reset-password');
}

/**
 * Supabase attaches the recovery session either as a query string
 * (`?access_token=...`) or a URL fragment (`#access_token=...`) depending on
 * the flow — merge both into one param bag so callers don't need to care
 * which one a given link used.
 */
export function parseAuthParams(url: string): URLSearchParams | null {
  const queryIndex = url.indexOf('?');
  const fragmentIndex = url.indexOf('#');
  if (queryIndex === -1 && fragmentIndex === -1) return null;

  const parts: string[] = [];
  if (queryIndex !== -1) {
    const end = fragmentIndex !== -1 && fragmentIndex > queryIndex ? fragmentIndex : undefined;
    parts.push(url.slice(queryIndex + 1, end));
  }
  if (fragmentIndex !== -1) {
    const end = queryIndex !== -1 && queryIndex > fragmentIndex ? queryIndex : undefined;
    parts.push(url.slice(fragmentIndex + 1, end));
  }

  try {
    return new URLSearchParams(parts.join('&'));
  } catch {
    return null;
  }
}

async function handleIncomingUrl(url: string | null): Promise<void> {
  if (!url || !isSupabaseConfigured || !supabase) return;

  const params = parseAuthParams(url);
  if (!params) return;

  const errorDescription = params.get('error_description');
  if (errorDescription) {
    logger.warn('auth-deep-link', 'Auth link carried an error', errorDescription);
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    logger.warn('auth-deep-link', 'Could not establish session from auth link', error.message);
    return;
  }

  if (type === 'recovery') {
    router.replace('/(auth)/reset-password');
  }
}

/** Mount once, near the app root (see app/_layout.tsx). */
export function useAuthDeepLink(): void {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    Linking.getInitialURL()
      .then(handleIncomingUrl)
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url).catch(() => {});
    });

    return () => subscription.remove();
  }, []);
}
