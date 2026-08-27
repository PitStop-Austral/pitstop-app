import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const variants = {
  display: ['h1', 'font-display text-[32px] font-bold tracking-[-0.03em]'],
  title: ['h1', 'font-display text-2xl font-bold tracking-[-0.03em]'],
  heading: ['h2', 'font-display text-xl font-bold'],
  subheading: ['h3', 'font-display text-lg font-bold'],
  'card-title': ['h3', 'font-display text-base font-bold'],
  body: ['p', 'font-sans text-sm font-normal'],
  'body-strong': ['p', 'font-sans text-sm font-semibold'],
  label: ['span', 'font-sans text-sm font-medium'],
  caption: ['span', 'font-sans text-xs font-normal'],
  'caption-strong': ['span', 'font-sans text-xs font-semibold'],
  overline: ['span', 'font-sans text-[11px] font-semibold uppercase tracking-[0.08em]'],
  numeric: ['span', 'font-display text-4xl font-bold tabular-nums tracking-tight'],
} as const satisfies Record<string, readonly [ElementType, string]>;

const colors = {
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
} as const;

export type TextVariant = keyof typeof variants;
export type TextColor = keyof typeof colors;

type TextProps<T extends ElementType = 'span'> = {
  as?: T;
  children: ReactNode;
  className?: string;
  color?: TextColor;
  variant?: TextVariant;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'color'>;

export function Text<T extends ElementType = 'span'>({
  as,
  children,
  className,
  color = 'default',
  variant = 'body',
  ...props
}: TextProps<T>) {
  const [defaultTag, styles] = variants[variant];
  const Tag = as ?? defaultTag;
  return (
    <Tag className={cn(styles, colors[color], className)} {...props}>
      {children}
    </Tag>
  );
}
