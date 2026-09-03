import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';

import { setUnauthorizedHandler } from './api-client';
import { AUTH_MESSAGES } from './auth-forms';
import { auth } from './firebase';
import { resolveSignOutNavigation, type SignOutOptions } from './sign-out-navigation';
import { toast } from '@/components/ui/sonner';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isSigningOut: boolean;
  isAuthenticating: boolean;
  setIsAuthenticating: (value: boolean) => void;
  signOut: (options?: SignOutOptions) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Manual verification helper: run `__pitstopDebug.forceSignOutFailure()` in
// the browser console to make the *next* signOut() call fail, so the
// catch/toast path can be seen without needing firebaseSignOut to actually
// fail (offline mode doesn't do it — it's mostly a local operation).
// Dead-code-eliminated from production builds.
let forceNextSignOutFailure = false;

if (import.meta.env.DEV) {
  const debugGlobal = window as unknown as { __pitstopDebug?: Record<string, unknown> };
  debugGlobal.__pitstopDebug = {
    ...debugGlobal.__pitstopDebug,
    forceSignOutFailure: () => {
      forceNextSignOutFailure = true;
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Set by login/register while Firebase auth has succeeded but their own
  // required bootstrap (/me, updateProfile, ...) hasn't resolved yet — see
  // docs/auth.md. Without this, _auth.tsx's guard treats `user` alone as
  // "fully logged in" and redirects away before bootstrap can fail visibly.
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // useRouter (not useLocation) so reading the current location doesn't make
  // AuthProvider re-render on every navigation in the app.
  const router = useRouter();

  const signOut = useCallback(
    async (options?: SignOutOptions): Promise<void> => {
      const currentHref = router.state.location.href;
      // Set before awaiting anything: onAuthStateChanged(null) fires and
      // updates `user` before firebaseSignOut's own promise resolves, so the
      // _app guard would otherwise race our navigate below with a stale
      // redirect target. isSigningOut suppresses that competing redirect.
      setIsSigningOut(true);
      try {
        if (import.meta.env.DEV && forceNextSignOutFailure) {
          forceNextSignOutFailure = false;
          throw new Error('Simulated firebaseSignOut failure (debug)');
        }
        await firebaseSignOut(auth);
        queryClient.clear();
        await navigate(resolveSignOutNavigation(currentHref, options));
      } catch (error) {
        console.error('Sign out failed', error);
        toast.error(AUTH_MESSAGES.generic);
      } finally {
        setIsSigningOut(false);
      }
    },
    [navigate, queryClient, router],
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => signOut({ preserveLocation: true }));
  }, [signOut]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isSigningOut,
    isAuthenticating,
    setIsAuthenticating,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
