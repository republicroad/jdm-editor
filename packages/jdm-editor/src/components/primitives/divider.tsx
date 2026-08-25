import * as React from 'react';

import { cn } from '@/lib/utils';

export const Divider: React.FC<{
  type?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
}> = ({ type = 'horizontal', className, style }) => (
  <div
    role="separator"
    className={cn(
      type === 'vertical' ? 'mx-1.5 inline-block h-[1.2em] w-px self-center bg-border' : 'my-2 w-full border-t border-border',
      className,
    )}
    style={style}
  />
);
