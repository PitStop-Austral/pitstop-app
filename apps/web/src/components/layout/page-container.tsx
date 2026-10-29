import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10', className)}>
      {children}
    </section>
  );
}
