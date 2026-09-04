import { Navigate, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useRef } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { FullScreenLoader } from '@/components/layout/full-screen-loader';
import { useAuth } from '@/lib/auth-context';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const { user, isLoading, isSigningOut } = useAuth();
  const location = useLocation();
  // Freezes once `user` goes null to avoid re-nesting the redirect param
  // mid-transition — see docs/auth.md before simplifying this.
  const lastAuthedHrefRef = useRef(location.href);
  if (user) {
    lastAuthedHrefRef.current = location.href;
  }

  if (isLoading || isSigningOut) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate replace search={{ redirect: lastAuthedHrefRef.current }} to="/login" />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <DesktopSidebar />
      <div className="min-w-0 flex-1">
        <AppHeader />
        <main className="pb-28 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
