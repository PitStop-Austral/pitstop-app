import { Select as SelectPrimitive } from '@base-ui/react/select';

import { useDialogContainer } from '@/components/ui/dialog-container-context';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
) {
  return <SelectPrimitive.Root {...props} />;
}

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-12 w-full items-center justify-between rounded-[14px] border border-input bg-card px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <Icon color="muted" name="ChevronDown" size="sm" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value {...props} />;
}

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, 'align' | 'sideOffset'>;

export function SelectContent({
  align = 'start',
  sideOffset = 4,
  className,
  ...props
}: SelectContentProps) {
  const dialogContainer = useDialogContainer();

  return (
    <SelectPrimitive.Portal container={dialogContainer}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={false}
        className="isolate z-50 outline-none"
        positionMethod={dialogContainer ? 'fixed' : undefined}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(
            'max-h-64 min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-[16px] border border-border bg-card p-2 shadow-overlay outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'flex min-h-10 cursor-default items-center justify-between gap-3 rounded-[10px] px-3 outline-none select-none data-highlighted:bg-neutral-100 data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.ItemIndicator>
        <Icon color="primary" name="Check" size="sm" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
