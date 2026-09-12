import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</section>
  );
}
