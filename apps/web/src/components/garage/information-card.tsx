import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type InformationCardProps = {
  children: ReactNode;
  className?: string;
  iconSrc: string;
  title: string;
};

export function InformationCard({ children, className, iconSrc, title }: InformationCardProps) {
  return (
    <div className={cn('rounded-[20px] border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[12px] bg-neutral-100 shadow-sm">
          <Icon size="xl" src={iconSrc} />
        </div>
        <Text variant="subheading">{title}</Text>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
