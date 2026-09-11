import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TextColor } from '@/components/ui/text';

const sizes = { xs: 14, sm: 16, md: 20, lg: 24, xl: 28 } as const;
const colors: Record<TextColor, string> = {
  default: 'text-neutral-900',
  muted: 'text-neutral-500',
  subtle: 'text-neutral-400',
  emphasis: 'text-neutral-700',
  primary: 'text-primary',
  'on-primary': 'text-white',
  inverse: 'text-neutral-50',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export type IconName = keyof typeof LucideIcons;

type IconProps = {
  size?: keyof typeof sizes | number;
  color?: TextColor;
  strokeWidth?: number;
  'aria-label'?: string;
  className?: string;
} & ({ name: IconName; src?: never } | { name?: never; src: string });

export function Icon({
  name,
  src,
  size = 'md',
  color = 'default',
  strokeWidth = 2,
  className,
  'aria-label': ariaLabel,
}: IconProps) {
  const resolvedSize = typeof size === 'number' ? size : sizes[size];

  if (src) {
    return (
      <img
        alt={ariaLabel ?? ''}
        aria-hidden={ariaLabel ? undefined : true}
        className={cn('object-contain', className)}
        height={resolvedSize}
        src={src}
        width={resolvedSize}
      />
    );
  }

  const LucideIcon = LucideIcons[name as IconName] as LucideIcon;
  return (
    <LucideIcon
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={cn(colors[color], className)}
      size={resolvedSize}
      strokeWidth={strokeWidth}
    />
  );
}
