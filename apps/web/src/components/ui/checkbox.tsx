import type { InputHTMLAttributes } from 'react';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function Checkbox({
  className,
  type = 'checkbox',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative inline-flex size-5 shrink-0">
      <input
        className={cn(
          'peer size-5 appearance-none rounded-sm border border-input bg-card checked:border-primary checked:bg-primary focus-visible:outline-3 focus-visible:outline-primary/50 disabled:opacity-50',
          className,
        )}
        type={type}
        {...props}
      />
      <Icon
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100"
        color="on-primary"
        name="Check"
        size="xs"
        strokeWidth={3}
      />
    </div>
  );
}
