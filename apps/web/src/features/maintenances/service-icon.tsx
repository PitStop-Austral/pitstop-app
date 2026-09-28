import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { serviceIconFor } from './service-catalog';

const sizes = {
  md: { container: 'size-11 rounded-md', image: 36 },
  sm: { container: 'size-10 rounded-md', image: 32 },
  xs: { container: 'size-9 rounded-sm', image: 28 },
} as const;

type ServiceIconProps = {
  type: string;
  size?: keyof typeof sizes;
  className?: string;
};

export function ServiceIcon({ type, size = 'md', className }: ServiceIconProps) {
  const styles = sizes[size];

  return (
    <div
      className={cn('grid shrink-0 place-items-center bg-neutral-100', styles.container, className)}
    >
      <Icon src={serviceIconFor(type)} size={styles.image} />
    </div>
  );
}
