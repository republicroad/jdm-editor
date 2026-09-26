import { cn } from '#lib/utils';
import * as React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('animate-pulse rounded-md bg-[var(--muted)]', className)} {...props} />
);
