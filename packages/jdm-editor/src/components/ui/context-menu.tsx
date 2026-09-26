'use client';

import { cn } from '#lib/utils';
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import * as React from 'react';

import { useSealPortalContainer } from '../../theming/portal-context';

function ContextMenu(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot='context-menu' {...props} />;
}

function ContextMenuTrigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot='context-menu-trigger' {...props} />;
}

function ContextMenuPortal(props: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  const sealContainer = useSealPortalContainer();
  return <ContextMenuPrimitive.Portal data-slot='context-menu-portal' container={sealContainer} {...props} />;
}

const ContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Popup> &
    Pick<ContextMenuPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>
>(({ className, side, sideOffset = 0, align, alignOffset, ...props }, ref) => {
  const sealContainer = useSealPortalContainer();
  return (
    <ContextMenuPrimitive.Portal container={sealContainer}>
      <ContextMenuPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}>
        <ContextMenuPrimitive.Popup
          ref={ref}
          data-slot='context-menu-content'
          className={cn(
            // box-border: portaled nodes live outside .seal-root preflight scope (HK-14).
            'box-border z-50 min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
});
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    variant?: 'default' | 'destructive';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    data-slot='context-menu-item'
    data-variant={variant}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      variant === 'destructive' &&
        'text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive',
      className,
    )}
    {...props}
  />
));
ContextMenuItem.displayName = 'ContextMenuItem';

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot='context-menu-separator'
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

// Base Menu `SubmenuRoot` is a context provider without a DOM ref.
function ContextMenuSub(props: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {
  return <ContextMenuPrimitive.SubmenuRoot data-slot='context-menu-sub' {...props} />;
}
ContextMenuSub.displayName = 'ContextMenuSub';

const ContextMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.SubmenuTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubmenuTrigger>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubmenuTrigger
    ref={ref}
    data-slot='context-menu-sub-trigger'
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </ContextMenuPrimitive.SubmenuTrigger>
));
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

const ContextMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Popup>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Popup> &
    Pick<ContextMenuPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>
>(({ className, side = 'right', sideOffset = 0, align, alignOffset, ...props }, ref) => {
  const sealContainer = useSealPortalContainer();
  return (
    <ContextMenuPrimitive.Portal container={sealContainer}>
      <ContextMenuPrimitive.Positioner side={side} sideOffset={sideOffset} align={align} alignOffset={alignOffset}>
        <ContextMenuPrimitive.Popup
          ref={ref}
          data-slot='context-menu-sub-content'
          className={cn(
            'box-border z-50 min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
});
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
};
