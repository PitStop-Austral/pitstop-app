import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type BadgeProps = HTMLAttributes<HTMLDivElement> & { variant?: 'neutral' | 'primary' };

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1',
        variant === 'primary' ? 'bg-red-50 text-primary' : 'bg-neutral-100 text-neutral-700',
        className,
      )}
      {...props}
    />
  );
}
