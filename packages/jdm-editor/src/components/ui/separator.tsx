import { cn } from '#lib/utils';
import * as React from 'react';

export const Separator: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }
> = ({ className, orientation = 'horizontal', ...props }) => (
  <div
    role='separator'
    aria-orientation={orientation}
    className={cn(
      'shrink-0 bg-[var(--border)]',
      orientation === 'vertical' ? 'w-px self-stretch' : 'h-px w-full',
      className,
    )}
    {...props}
  />
);
