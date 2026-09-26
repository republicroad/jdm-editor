import { cn } from '#lib/utils';
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperSeparator, StepperTrigger } from '#reui/stepper';
import * as React from 'react';

/**
 * Antd-flavored Steps API over the vendored ReUI stepper. Read-only by
 * design: the host drives `current` (the Excel dialog's Next/Previous
 * buttons), so trigger clicks are absorbed with a no-op change handler.
 * Steps are 1-based inside the stepper — map the 0-based `current`.
 */
export const Steps: React.FC<{
  current?: number;
  items?: Array<{ title?: React.ReactNode; description?: React.ReactNode }>;
}> = ({ current = 0, items = [] }) => (
  <Stepper
    value={current + 1}
    onValueChange={() => {}}
    className='w-full'
    indicators={{
      completed: <span className='text-[10px]'>✓</span>,
    }}
  >
    <StepperNav className='gap-1'>
      {items.map((item, index) => {
        const step = index + 1;
        return (
          <StepperItem key={step} step={step} className='flex-1'>
            <StepperTrigger className='pointer-events-none w-full items-start gap-1.5 px-1'>
              <StepperIndicator className='size-6 text-[10px]' />
              {(item.title || item.description) && (
                <span className='flex min-w-0 flex-col text-left'>
                  {item.title ? (
                    <span
                      className={cn(
                        'truncate text-xs leading-tight',
                        'group-data-[state=inactive]/step:text-muted-foreground',
                      )}
                    >
                      {item.title}
                    </span>
                  ) : null}
                  {item.description ? (
                    <span className='truncate text-[10px] leading-tight text-muted-foreground'>{item.description}</span>
                  ) : null}
                </span>
              )}
            </StepperTrigger>
            {index < items.length - 1 ? <StepperSeparator className='flex-1' /> : null}
          </StepperItem>
        );
      })}
    </StepperNav>
  </Stepper>
);
