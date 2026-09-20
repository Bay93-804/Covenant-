import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { defaultOnboardingData, type OnboardingData } from './schema';

interface OnboardingContextValue {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Holds in-progress onboarding answers across the multi-step route stack until final submission. */
export function OnboardingProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => setData((prev) => ({ ...prev, ...patch })),
      reset: () => setData(defaultOnboardingData),
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
