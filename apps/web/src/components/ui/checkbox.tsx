import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Checkbox({
  className,
  type = 'checkbox',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'size-5 appearance-none rounded-[10px] border border-input bg-card checked:border-primary checked:bg-primary focus-visible:outline-4 focus-visible:outline-primary/10 disabled:opacity-50',
        className,
      )}
      type={type}
      {...props}
    />
  );
}
