import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content min-h-24 w-full resize-none rounded-[14px] border border-input bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-neutral-400 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
