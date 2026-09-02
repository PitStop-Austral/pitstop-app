import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AuthLayout } from '@/components/auth/auth-layout';

export const Route = createFileRoute('/_auth')({
  component: AuthRoute,
});

function AuthRoute() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
