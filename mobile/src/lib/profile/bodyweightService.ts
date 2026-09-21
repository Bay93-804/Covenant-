/**
 * Bodyweight is only ever needed for marker #7's "x bodyweight"
 * classification (trap-bar deadlift E1RM — see
 * src/features/testing/markerFormats.ts's `classifyE1rmResult`). Nothing in
 * onboarding collects it today, so it is captured lazily, the first time the
 * athlete enters that marker, and stored on `profiles.bodyweight_lb` (a
 * column the Phase 1 schema already reserves for this) — same branch-once
 * pattern as `src/lib/enrollment/enrollmentService.ts`.
 */
import { getDemoProfile, upsertDemoProfile } from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import { requireSupabase } from '../supabase/client';

export async function getBodyweightLb(userId: string): Promise<number | null> {
  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('bodyweight_lb')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.bodyweight_lb ?? null;
  }
  const profile = await getDemoProfile(userId);
  return profile?.bodyweight_lb ?? null;
}

export async function setBodyweightLb(userId: string, bodyweightLb: number): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ bodyweight_lb: bodyweightLb })
      .eq('id', userId);
    if (error) throw error;
    return;
  }
  await upsertDemoProfile(userId, { bodyweight_lb: bodyweightLb });
}
