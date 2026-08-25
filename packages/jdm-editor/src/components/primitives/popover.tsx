import * as React from 'react';
import {
  Popover as UiPopover,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '@/components/ui/popover';

export interface AntdPopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  content?: React.ReactNode;
  title?: React.ReactNode;
  trigger?: Array<'click' | 'hover' | 'contextMenu'> | 'click' | 'hover';
  placement?: string;
  destroyTooltipOnHide?: boolean;
  arrow?: boolean;
  overlayClassName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const Popover: React.FC<AntdPopoverProps> = ({
  open,
  onOpenChange,
  content,
  children,
}) => (
  <UiPopover open={open} onOpenChange={onOpenChange}>
    <UiPopoverTrigger asChild>
      {React.isValidElement(children) ? children : <span className="inline-flex">{children}</span>}
    </UiPopoverTrigger>
    <UiPopoverContent>{content}</UiPopoverContent>
  </UiPopover>
);
