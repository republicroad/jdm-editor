import { cn } from '#lib/utils';

/** 骨架屏（shadcn skeleton 原语）：加载占位脉冲动画。 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='skeleton' className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
