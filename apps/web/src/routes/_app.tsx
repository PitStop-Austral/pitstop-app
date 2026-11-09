import { Navigate, Outlet, createFileRoute, useLocation } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { FullScreenLoader } from '@/components/layout/full-screen-loader';
import { MaintenanceSheetProvider } from '@/features/maintenances/maintenance-sheet-context';
import { NotificationMessageListener } from '@/features/notifications/notification-message-listener';
import { ScheduleSheetProvider } from '@/features/schedules/schedule-sheet-context';
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

  useEffect(() => {
    if (!user) return;
    const root = document.documentElement;
    root.classList.add('app-shell');
    return () => root.classList.remove('app-shell');
  }, [user]);

  if (user) {
    lastAuthedHrefRef.current = location.href;
  }

  if (isLoading || isSigningOut) {
    return <FullScreenLoader />;
  }

  if (!user) {
    // Inicio is the default destination already, so it isn't carried as `redirect`.
    const redirect = lastAuthedHrefRef.current === '/' ? undefined : lastAuthedHrefRef.current;
    return <Navigate replace search={{ redirect }} to="/bienvenida" />;
  }

  return (
    <MaintenanceSheetProvider>
      <ScheduleSheetProvider>
        <NotificationMessageListener userId={user.uid} />
        <div className="flex h-app overflow-hidden bg-background">
          <DesktopSidebar />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main
              className="flex-1 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),12px)+88px)] [scrollbar-gutter:stable] lg:pb-10"
              id="app-scroll"
            >
              <Outlet />
            </main>
            <BottomNav />
          </div>
        </div>
      </ScheduleSheetProvider>
    </MaintenanceSheetProvider>
  );
}
