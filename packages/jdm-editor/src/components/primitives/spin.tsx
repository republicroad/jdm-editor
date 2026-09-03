import { cn } from '#lib/utils';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

export const Spin: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    size?: 'large' | 'default' | 'small';
    spinning?: boolean;
    children?: React.ReactNode;
  }
> = ({ size = 'default', spinning = true, children, className, style, ...rest }) => {
  const spinnerClass = size === 'large' ? 'size-8' : size === 'small' ? 'size-4' : 'size-6';

  if (!children) {
    return (
      <div
        role='status'
        className={cn('flex w-full items-center justify-center p-2', className)}
        style={style}
        {...rest}
      >
        <Loader2 className={cn('animate-spin text-muted-foreground', spinnerClass)} />
      </div>
    );
  }

  if (!spinning) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)} style={style} {...rest}>
      {children}
      <div className='absolute inset-0 z-10 flex items-center justify-center rounded-(--grl-border-radius) bg-background/60'>
        <Loader2 className={cn('animate-spin text-muted-foreground', spinnerClass)} />
      </div>
    </div>
  );
};
