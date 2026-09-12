import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DialogContainerProvider } from '@/components/ui/dialog-container-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissible = true,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <DialogContainerProvider value={dialogRef}>
      <dialog
        aria-labelledby="bottom-sheet-title"
        className="mx-auto mt-auto mb-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[24px] bg-card p-0 shadow-overlay backdrop:bg-neutral-900/40 open:animate-sheet-in lg:m-auto lg:max-w-lg lg:rounded-[24px] lg:open:animate-overlay-in"
        onCancel={(event) => {
          if (!dismissible) {
            event.preventDefault();
            return;
          }
          onOpenChange(false);
        }}
        onClick={(event) => {
          if (dismissible && event.target === event.currentTarget) onOpenChange(false);
        }}
        onClose={() => onOpenChange(false)}
        ref={dialogRef}
      >
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-neutral-200 lg:hidden" />
          <div className="flex items-start gap-4 px-6 pt-5 pb-4">
            <div className="flex-1">
              <Text as="h2" id="bottom-sheet-title" variant="heading">
                {title}
              </Text>
              {description ? (
                <Text className="mt-1" color="muted" variant="body">
                  {description}
                </Text>
              ) : null}
            </div>
            <Button
              aria-label="Cerrar"
              disabled={!dismissible}
              size="icon"
              variant="icon"
              onClick={() => onOpenChange(false)}
            >
              <Icon color="muted" name="X" size="sm" />
            </Button>
          </div>
          <div className="no-scrollbar overflow-y-auto px-6 pb-6">{children}</div>
          {footer ? (
            <div className="border-t border-border px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </div>
      </dialog>
    </DialogContainerProvider>
  );
}
