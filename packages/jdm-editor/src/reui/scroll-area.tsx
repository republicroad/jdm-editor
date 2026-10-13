import { cn } from '#lib/utils';
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';

/**
 * ScrollArea 薄封装（reui/base-nova API 面：`<ScrollArea className>` 即完整），
 * 走 Base UI scroll-area——external 依赖，零 kernel 包体成本。
 */
function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root data-slot='scroll-area' className={cn('relative', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot='scroll-area-viewport'
        className='size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1'
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot='scroll-area-scrollbar'
      orientation={orientation}
      className={cn(
        'flex touch-none select-none p-px opacity-0 transition-opacity duration-150 data-[hovering]:opacity-100 data-[scrolling]:opacity-100',
        orientation === 'vertical' ? 'w-2.5 border-l border-l-transparent' : 'h-2.5 border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb data-slot='scroll-area-thumb' className='relative flex-1 rounded-full bg-border' />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
