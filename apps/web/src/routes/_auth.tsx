import { Outlet, createFileRoute, useSearch } from '@tanstack/react-router';

import { AuthLayout } from '@/components/auth/auth-layout';
import { GuestOnly } from '@/components/auth/guest-only';

export const Route = createFileRoute('/_auth')({
  component: AuthRoute,
});

function AuthRoute() {
  const search = useSearch({ strict: false }) as { redirect?: string };

  return (
    <GuestOnly redirect={search.redirect}>
      <AuthLayout>
        <Outlet />
      </AuthLayout>
    </GuestOnly>
  );
}
