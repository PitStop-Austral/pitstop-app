import type { ReactNode } from 'react';

import authBanner from '@/assets/auth-banner.webp';
import { Text } from '@/components/ui/text';

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="h-dvh overflow-hidden bg-neutral-900 lg:flex lg:bg-background">
      <div className="relative h-[30dvh] min-h-[200px] shrink-0 overflow-hidden lg:sticky lg:top-0 lg:h-dvh lg:w-1/2">
        <img
          alt=""
          className="size-full object-cover"
          decoding="async"
          fetchPriority="high"
          src={authBanner}
        />
        <div className="absolute inset-0 bg-linear-to-t from-neutral-900/80 to-neutral-900/10" />
        <div className="absolute bottom-14 left-12 hidden max-w-lg lg:block">
          <Text color="on-primary" variant="display">
            Tu garage, siempre al día.
          </Text>
          <div className="mt-4 opacity-75">
            <Text color="inverse" variant="body">
              Historial, avisos y ficha técnica de todos tus vehículos en un solo lugar.
            </Text>
          </div>
        </div>
      </div>

      <main className="safe-bottom relative z-10 -mt-7 h-[calc(70dvh+1.75rem)] flex-1 overflow-y-auto rounded-t-[32px] bg-card px-6 pt-9 lg:mt-0 lg:flex lg:h-dvh lg:items-center lg:rounded-none lg:bg-background lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-[400px] pb-10 lg:pb-0">{children}</div>
      </main>
    </div>
  );
}
