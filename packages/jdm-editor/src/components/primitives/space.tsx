import { cn } from '@/lib/utils';
import * as React from 'react';

export type SpaceProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number | [number, number] | 'small' | 'middle' | 'large';
  direction?: 'horizontal' | 'vertical';
  wrap?: boolean;
};

export const Space: React.FC<SpaceProps> = ({
  size = 8,
  direction = 'horizontal',
  wrap,
  className,
  style,
  ...rest
}) => {
  const resolved = size === 'small' ? 8 : size === 'middle' ? 16 : size === 'large' ? 24 : size;
  const gap = Array.isArray(resolved) ? `${resolved[1]}px ${resolved[0]}px` : `${resolved}px`;
  return (
    <div
      className={cn(
        direction === 'vertical' ? 'flex flex-col' : 'flex flex-row items-center',
        wrap && (direction === 'vertical' ? '' : 'flex-wrap'),
        className,
      )}
      style={{ gap, ...style }}
      {...rest}
    />
  );
};
