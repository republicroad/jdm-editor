import { cn } from '#lib/utils';
import * as React from 'react';

export const Avatar: React.FC<
  Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
    src?: string;
    alt?: string;
    size?: number | 'large' | 'default' | 'small';
    shape?: 'circle' | 'square';
    icon?: React.ReactNode;
    children?: React.ReactNode;
  }
> = ({ src, alt, size = 'default', shape = 'circle', className, style, children, icon, ...rest }) => {
  const pxSize = typeof size === 'number' ? size : size === 'large' ? 40 : size === 'small' ? 24 : 32;
  return (
    <div
      className={cn(
        'flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted text-xs font-medium text-muted-foreground',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        className,
      )}
      style={{ width: pxSize, height: pxSize, ...style }}
      {...rest}
    >
      {src ? <img src={src} alt={alt} className='size-full object-cover' /> : (children ?? icon)}
    </div>
  );
};
