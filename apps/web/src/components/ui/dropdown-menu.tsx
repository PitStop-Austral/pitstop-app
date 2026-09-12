import { Menu as MenuPrimitive } from '@base-ui/react/menu';

import { useDialogContainer } from '@/components/ui/dialog-container-context';
import { cn } from '@/lib/utils';

export function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger {...props} />;
}

type DropdownMenuContentProps = MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'sideOffset'>;

export function DropdownMenuContent({
  align = 'end',
  sideOffset = 8,
  className,
  ...props
}: DropdownMenuContentProps) {
  const dialogContainer = useDialogContainer();

  return (
    <MenuPrimitive.Portal container={dialogContainer}>
      <MenuPrimitive.Positioner
        align={align}
        className="isolate z-50 outline-none"
        positionMethod={dialogContainer ? 'fixed' : undefined}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          className={cn(
            'min-w-48 origin-(--transform-origin) rounded-[16px] border border-border bg-card p-2 shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex min-h-10 cursor-default items-center gap-3 rounded-[10px] px-3 outline-none select-none focus:bg-neutral-100 data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
