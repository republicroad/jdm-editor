import {
  Popover as UiPopover,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '#components/ui/popover';
import * as React from 'react';

export interface PopoverProps {
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

export const Popover: React.FC<PopoverProps> = ({ open, onOpenChange, content, children }) => (
  <UiPopover open={open} onOpenChange={onOpenChange}>
    {/*
     * Wrap the child in a real DOM element unconditionally: Base UI
     * `render` merges its handlers into the rendered element, and cloning
     * through a non-DOM subtree (e.g. a Tooltip context provider wrapping a
     * Button, as dialog row actions do) silently drops them.
     */}
    <UiPopoverTrigger render={<span className='inline-flex'>{children}</span>} />
    <UiPopoverContent>{content}</UiPopoverContent>
  </UiPopover>
);
