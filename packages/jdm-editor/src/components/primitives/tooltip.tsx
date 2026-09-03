import {
  TooltipContent as UiTooltipContent,
  TooltipProvider as UiTooltipProvider,
  Tooltip as UiTooltipRoot,
  TooltipTrigger as UiTooltipTrigger,
} from '#components/ui/tooltip';
import * as React from 'react';

const placementSideMap: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  topLeft: 'top',
  topRight: 'top',
  bottomLeft: 'bottom',
  bottomRight: 'bottom',
};

export const Tooltip: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    title?: React.ReactNode;
    placement?: keyof typeof placementSideMap;
    open?: boolean;
    children?: React.ReactNode;
  }
> = ({ title, placement = 'top', children }) => {
  if (!title || !children) {
    return <>{children}</>;
  }
  return (
    <UiTooltipProvider delayDuration={200}>
      <UiTooltipRoot>
        <UiTooltipTrigger asChild>
          {React.isValidElement(children) ? children : <span className='inline-flex'>{children}</span>}
        </UiTooltipTrigger>
        <UiTooltipContent side={placementSideMap[placement] ?? 'top'}>{title}</UiTooltipContent>
      </UiTooltipRoot>
    </UiTooltipProvider>
  );
};
