import { cn } from '#lib/utils';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import * as React from 'react';

import { useSealPortalContainer } from '../../theming/portal-context';

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> &
  Pick<PopoverPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>) {
  const sealContainer = useSealPortalContainer();
  return (
    <PopoverPrimitive.Portal container={sealContainer}>
      <PopoverPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}>
        <PopoverPrimitive.Popup
          data-slot='popover-content'
          className={cn(
            // box-border: portaled nodes live outside .seal-root preflight scope (HK-14).
            'box-border z-50 w-fit min-w-[18rem] origin-(--transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='popover-header' className={cn('flex flex-col gap-1 text-sm', className)} {...props} />;
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <div data-slot='popover-title' className={cn('font-medium', className)} {...props} />;
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot='popover-description' className={cn('text-muted-foreground', className)} {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle, PopoverDescription };
