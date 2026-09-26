'use client';

import { cn } from '#lib/utils';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import * as React from 'react';

import { useSealPortalContainer } from '../../theming/portal-context';

function TooltipProvider({ delay = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot='tooltip-provider' delay={delay} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot='tooltip' {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot='tooltip-trigger' {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  side,
  align,
  alignOffset,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> &
  Pick<TooltipPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>) {
  const sealContainer = useSealPortalContainer();
  return (
    <TooltipPrimitive.Portal container={sealContainer}>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}>
        <TooltipPrimitive.Popup
          data-slot='tooltip-content'
          className={cn(
            // box-border: portaled nodes live outside .seal-root preflight scope (HK-14).
            'box-border z-50 w-fit origin-(--transform-origin) rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background shadow-md transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className='z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground' />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
