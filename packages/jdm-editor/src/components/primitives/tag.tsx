import { cn } from '#lib/utils';
import * as React from 'react';

export const Tag: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ className, style, children }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs', className)} style={style}>
    {children}
  </span>
);
