import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full bg-neutral-200 outline-none transition-colors data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-5 motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
