import { Navigate, Outlet, createFileRoute, useSearch } from '@tanstack/react-router';

import { AuthLayout } from '@/components/auth/auth-layout';
import { FullScreenLoader } from '@/components/layout/full-screen-loader';
import { useAuth } from '@/lib/auth-context';
import { getSafeRedirect } from '@/lib/redirect';

export const Route = createFileRoute('/_auth')({
  component: AuthRoute,
});

function AuthRoute() {
  const { user, isLoading, isAuthenticating } = useAuth();
  const search = useSearch({ strict: false }) as { redirect?: string };

  if (isLoading) {
    return <FullScreenLoader />;
  }

  // isAuthenticating: login/register have a Firebase user but their own
  // bootstrap (see docs/auth.md) hasn't resolved yet. Only suppress the
  // redirect here — swapping to <FullScreenLoader/> would unmount <Outlet/>
  // and, with it, the mutation whose error this guard must let render.
  if (user && !isAuthenticating) {
    return <Navigate replace to={getSafeRedirect(search.redirect) ?? '/'} />;
  }

  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
