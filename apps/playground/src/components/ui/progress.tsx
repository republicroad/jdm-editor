import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from 'cn';
import * as React from 'react';

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot='progress'
      className={cn('relative h-2 w-full', className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot='progress-track'
        className='h-2 w-full overflow-hidden rounded-full bg-primary/20'
      >
        <ProgressPrimitive.Indicator
          data-slot='progress-indicator'
          className='h-full w-full flex-1 bg-primary transition-all'
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
