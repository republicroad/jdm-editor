import {
  Popover as UiPopover,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '@/components/ui/popover';
import * as React from 'react';

/** @deprecated antd-migration compat alias — use {@link PopoverProps} instead. */
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

export const Popover: React.FC<AntdPopoverProps> = ({ open, onOpenChange, content, children }) => (
  <UiPopover open={open} onOpenChange={onOpenChange}>
    {/*
     * Wrap the child in a real DOM element unconditionally: Radix `asChild`
     * (Slot) clones its handlers onto its DIRECT child only. When callers pass
     * a non-DOM subtree (e.g. a Tooltip context provider wrapping a Button —
     * see ImportColumnRow in dt-excel-dialog), handlers were silently dropped
     * and the popover never opened.
     */}
    <UiPopoverTrigger asChild>
      <span className='inline-flex'>{children}</span>
    </UiPopoverTrigger>
    <UiPopoverContent>{content}</UiPopoverContent>
  </UiPopover>
);

/** Neutral name (antd-migration compat surface). */
export type PopoverProps = AntdPopoverProps;
