import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { createDefaultOnboardingData, type OnboardingData } from './schema';

interface OnboardingContextValue {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Holds in-progress onboarding answers across the multi-step route stack until final submission. */
export function OnboardingProvider({ children }: PropsWithChildren) {
  // Lazy initializer: computes today-relative defaults (Week 1 Start Date)
  // at the moment onboarding actually starts, not at module-import time.
  const [data, setData] = useState<OnboardingData>(() => createDefaultOnboardingData());

  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => setData((prev) => ({ ...prev, ...patch })),
      reset: () => setData(createDefaultOnboardingData()),
    }),
    [data],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
