import type { ReactNode } from 'react';

import { DialogContainerProvider, useNativeDialog } from '@/components/ui/dialog-container-context';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  const ref = useNativeDialog(open);
  return (
    <DialogContainerProvider value={ref}>
      <dialog
        className={cn('touch-none', className)}
        onCancel={() => onOpenChange(false)}
        onClose={() => onOpenChange(false)}
        ref={ref}
      >
        {children}
      </dialog>
    </DialogContainerProvider>
  );
}
