import * as React from 'react';

import { cn } from '@/lib/utils';

export const Steps: React.FC<{
  current?: number;
  items?: Array<{ title?: React.ReactNode; description?: React.ReactNode }>;
}> = ({ current = 0, items = [] }) => (
  <div className="flex w-full items-center">
    {items.map((item, index) => {
      const state = index < current ? 'done' : index === current ? 'active' : 'pending';
      return (
        <React.Fragment key={index}>
          {index > 0 ? (
            <div className={cn('h-px flex-1', state === 'pending' ? 'bg-border' : 'bg-primary')} />
          ) : null}
          <div className="flex items-center gap-2 px-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                state === 'done' && 'bg-primary text-primary-foreground',
                state === 'active' && 'border-2 border-primary text-primary',
                state === 'pending' && 'border border-border text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            {item.title ? (
              <span
                className={cn(
                  'whitespace-nowrap text-xs',
                  state === 'pending' ? 'text-muted-foreground' : 'font-medium text-foreground',
                )}
              >
                {item.title}
              </span>
            ) : null}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);
