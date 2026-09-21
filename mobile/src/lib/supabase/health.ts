/**
 * A lightweight production connectivity check — "can this device actually
 * reach the configured Supabase project right now?" — separate from
 * `isSupabaseConfigured` (which only checks that URL/key look well-formed,
 * not that they work). Used to show a clear, actionable banner instead of
 * individual screens each failing in their own confusing way when the
 * project URL is wrong, the project is paused, or the device has no
 * connectivity.
 *
 * Never used in demo mode — there is nothing to check.
 */
import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured } from '../env';
import { supabase } from './client';

export type SupabaseHealth = { reachable: true } | { reachable: false; reason: string };

const HEALTH_CHECK_TIMEOUT_MS = 8_000;

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  if (!isSupabaseConfigured || !supabase) {
    return { reachable: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    // A cheap, RLS-safe read: every authenticated user can select from
    // program_versions (see supabase/migrations/20250601000008_row_level_security.sql),
    // so this only proves reachability, never leaks another athlete's data.
    const { error } = await supabase
      .from('program_versions')
      .select('id', { head: true, count: 'exact' })
      .abortSignal(controller.signal)
      .limit(1);

    if (error) {
      return { reachable: false, reason: error.message };
    }
    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      reason: error instanceof Error ? error.message : 'Unknown network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Polls connectivity in the background. Disabled entirely in demo mode.
 * Intentionally infrequent (this is a "tell the athlete something's wrong,
 * don't spam the project") — individual screens still handle their own
 * request failures regardless of this.
 */
export function useSupabaseHealth() {
  return useQuery({
    queryKey: ['supabase-health'],
    queryFn: checkSupabaseHealth,
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    refetchInterval: isSupabaseConfigured ? 60_000 : false,
    retry: 1,
  });
}
