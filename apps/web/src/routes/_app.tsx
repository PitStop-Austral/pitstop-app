import { Navigate, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useRef } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { FullScreenLoader } from '@/components/layout/full-screen-loader';
import { MaintenanceSheetProvider } from '@/features/maintenances/maintenance-sheet-context';
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
    <MaintenanceSheetProvider>
      <div className="flex h-app overflow-hidden bg-background">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main
            className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] lg:pb-10"
            id="app-scroll"
          >
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
    </MaintenanceSheetProvider>
  );
}
