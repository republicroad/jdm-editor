import { cn } from '@/lib/utils';
import React from 'react';

export type GraphCardProps = React.HTMLAttributes<HTMLDivElement>;

export const GraphCard: React.FC<GraphCardProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'relative flex flex-col border border-[var(--grl-color-border)] bg-[var(--node-background)]',
        'cursor-grab rounded-[var(--node-border-radius)] [transition:var(--grl-transition)]',
        'group-hover/dn:border-[var(--grl-color-border-hover)]',
        className,
      )}
      {...props}
    />
  );
};
