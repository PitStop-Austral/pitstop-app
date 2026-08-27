import type { ComponentProps, ReactNode } from 'react';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type EmptyStateProps = {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-neutral-100">
        <Icon color="subtle" name={icon} size="lg" strokeWidth={1.75} />
      </div>
      <Text variant="subheading">{title}</Text>
      <Text className="mt-2 max-w-sm" color="muted" variant="body">
        {description}
      </Text>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
