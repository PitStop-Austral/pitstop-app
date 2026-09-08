import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const TabsContext = createContext<{ value: string; setValue: (value: string) => void } | null>(
  null,
);
const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within Tabs');
  return context;
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;
  return (
    <TabsContext value={{ value: currentValue, setValue }}>
      <div>{children}</div>
    </TabsContext>
  );
}
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-4 border-b border-border', className)}>{children}</div>;
}
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const tabs = useTabs();
  const active = tabs.value === value;
  return (
    <button
      aria-selected={active}
      className={cn('border-b-2 px-1 pb-3', active ? 'border-primary' : 'border-transparent')}
      role="tab"
      type="button"
      onClick={() => tabs.setValue(value)}
    >
      <Text color={active ? 'default' : 'muted'} variant="label">
        {children}
      </Text>
    </button>
  );
}
export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  return useTabs().value === value ? (
    <div className="pt-4" role="tabpanel">
      {children}
    </div>
  ) : null;
}
