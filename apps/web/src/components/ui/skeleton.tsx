import { cn } from '@/lib/utils';

export type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-neutral-100 motion-reduce:animate-none',
        className,
      )}
    />
  );
}
