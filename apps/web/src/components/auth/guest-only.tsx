import { useNavigate } from '@tanstack/react-router';
import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';

import { FullScreenLoader } from '@/components/layout/full-screen-loader';
import { useAuth } from '@/lib/auth-context';
import { getPostAuthRedirect } from '@/lib/redirect';

type GuestOnlyProps = {
  children: ReactNode;
  redirect?: string;
};

// Shared by the public auth screens and the landing: an authenticated user
// goes to `redirect` (a full href, query included) or Inicio.
export function GuestOnly({ children, redirect }: GuestOnlyProps) {
  const { user, isLoading, isAuthenticating } = useAuth();
  const navigate = useNavigate();
  const shouldLeave = !isLoading && user !== null && !isAuthenticating;
  const destination = getPostAuthRedirect(redirect) ?? '/';

  // Same as <Navigate>, which runs navigate() in a layout effect, but typed for
  // `href`: <Navigate> requires `to`, and `to` would drop the destination's query.
  useLayoutEffect(() => {
    if (shouldLeave) {
      void navigate({ href: destination, replace: true });
    }
  }, [shouldLeave, destination, navigate]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  // Don't swap this branch to <FullScreenLoader/> — see docs/auth.md.
  if (shouldLeave) {
    return null;
  }

  return children;
}
