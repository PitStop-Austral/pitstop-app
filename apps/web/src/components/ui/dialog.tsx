import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && open && !dialog.open) dialog.showModal();
    if (dialog && !open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      className={className}
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
      ref={ref}
    >
      {children}
    </dialog>
  );
}
