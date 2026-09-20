import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { getDemoProfile } from '../demo/demoContentStore';
import { isSupabaseConfigured } from '../env';
import { requireSupabase } from '../supabase/client';

export interface ProfileSummary {
  displayName: string | null;
  unitsWeight: 'lb' | 'kg';
  unitsDistance: 'mi' | 'km';
}

async function fetchProfileSummary(userId: string): Promise<ProfileSummary> {
  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, units_weight, units_distance')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return {
      displayName: data.display_name,
      unitsWeight: data.units_weight,
      unitsDistance: data.units_distance,
    };
  }

  const profile = await getDemoProfile(userId);
  return {
    displayName: profile?.display_name ?? null,
    unitsWeight: profile?.units_weight ?? 'lb',
    unitsDistance: profile?.units_distance ?? 'mi',
  };
}

export function useProfileSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile-summary', user?.id],
    queryFn: () => fetchProfileSummary(user!.id),
    enabled: Boolean(user),
  });
}
