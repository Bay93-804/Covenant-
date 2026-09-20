import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { getEnrollmentStatus } from './onboardingService';

export function useEnrollmentStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['enrollment-status', user?.id],
    queryFn: () => getEnrollmentStatus(user!.id),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}
