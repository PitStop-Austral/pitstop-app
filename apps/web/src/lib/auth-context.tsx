import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';

import { setUnauthorizedHandler } from './api-client';
import { AUTH_MESSAGES } from './auth-forms';
import { auth } from './firebase';
import { createSignOut } from './sign-out';
import { toast } from '@/components/ui/sonner';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isSigningOut: boolean;
  isAuthenticating: boolean;
  setIsAuthenticating: (value: boolean) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  const signOut = useMemo(
    () =>
      createSignOut({
        firebaseSignOut: () => firebaseSignOut(auth),
        clearQueryCache: () => queryClient.clear(),
        navigateToLogin: () => navigate({ to: '/login', replace: true, search: {} }),
        onError: (error) => {
          console.error('Sign out failed', error);
          toast.error(AUTH_MESSAGES.generic);
        },
        setIsSigningOut,
      }),
    [navigate, queryClient],
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
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
