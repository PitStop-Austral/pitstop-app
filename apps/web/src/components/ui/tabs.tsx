import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TabsContext = createContext<{ value: string; setValue: (value: string) => void } | null>(
  null,
);
const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within Tabs');
  return context;
};

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext value={{ value, setValue }}>
      <div>{children}</div>
    </TabsContext>
  );
}
export function TabsList({ children }: { children: ReactNode }) {
  return <div className="flex gap-4 border-b border-border">{children}</div>;
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
      {children}
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
