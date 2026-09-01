import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
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
