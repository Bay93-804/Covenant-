import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  demoRequestPasswordReset,
  demoSignIn,
  demoSignOut,
  demoSignUp,
  getDemoSession,
  onDemoAuthStateChange,
} from '../demo/demoAuth';
import { passwordResetRedirectUrl } from './authDeepLink';
import { isSupabaseConfigured } from '../env';
import { supabase } from '../supabase/client';

export interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** True when running on local mock auth because Supabase env vars are absent. */
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const sessionUser = data.session?.user;
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
        setIsLoading(false);
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        const sessionUser = session?.user;
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
      });

      return () => {
        mounted = false;
        subscription.subscription.unsubscribe();
      };
    }

    getDemoSession().then((demoUser) => {
      if (!mounted) return;
      setUser(demoUser ? { id: demoUser.id, email: demoUser.email } : null);
      setIsLoading(false);
    });

    const unsubscribe = onDemoAuthStateChange((demoUser) => {
      setUser(demoUser ? { id: demoUser.id, email: demoUser.email } : null);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isDemoMode: !isSupabaseConfigured,
      async signIn(email, password) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          return;
        }
        await demoSignIn(email, password);
      },
      async signUp(email, password) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          return;
        }
        await demoSignUp(email, password);
      },
      async signOut() {
        // Clear every cached query first — query keys that aren't
        // user-scoped (or a stale in-flight refetch for the outgoing user)
        // must never be visible for even one frame to whichever account
        // signs in next on this device.
        queryClient.clear();
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
          return;
        }
        await demoSignOut();
      },
      async requestPasswordReset(email) {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: passwordResetRedirectUrl(),
          });
          if (error) throw error;
          return;
        }
        await demoRequestPasswordReset(email);
      },
    }),
    [user, isLoading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
