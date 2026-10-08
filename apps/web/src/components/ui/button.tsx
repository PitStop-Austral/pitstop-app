import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon' | 'link';
  size?: 'default' | 'icon';
};

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />
  );
}

export function buttonVariants({
  variant = 'primary',
  size = 'default',
}: Pick<ButtonProps, 'variant' | 'size'>) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-red-700 shadow-sm',
    secondary: 'border border-border bg-card hover:bg-neutral-100',
    ghost: 'hover:bg-neutral-100',
    destructive: 'border border-destructive/30 bg-card text-destructive hover:bg-red-50',
    icon: 'bg-neutral-100 text-muted-foreground hover:bg-neutral-200',
    link: 'h-auto cursor-pointer rounded-none px-0 text-primary hover:underline',
  };
  return cn(
    'inline-flex items-center justify-center focus-visible:outline-4 focus-visible:outline-primary/10 disabled:pointer-events-none disabled:opacity-50',
    variant === 'link' ? '' : 'rounded-full px-5',
    variants[variant],
    size === 'icon' ? 'size-9 p-0' : variant === 'link' ? '' : 'h-12',
  );
}
