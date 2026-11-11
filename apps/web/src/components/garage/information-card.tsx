import type { ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type InformationCardProps = {
  children: ReactNode;
  className?: string;
  title: string;
} & ({ icon: IconName; iconSrc?: never } | { icon?: never; iconSrc: string });

export function InformationCard({
  children,
  className,
  icon,
  iconSrc,
  title,
}: InformationCardProps) {
  return (
    <div className={cn('rounded-[20px] border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[12px] bg-neutral-100 shadow-sm">
          {icon ? <Icon color="default" name={icon} size="lg" /> : <Icon size="xl" src={iconSrc} />}
        </div>
        <Text variant="subheading">{title}</Text>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
