import { Checkbox as UiCheckbox } from '#components/ui/checkbox';
import { cn } from '#lib/utils';
import * as React from 'react';

export interface CheckboxChangeEvent {
  target: { checked: boolean };
  stopPropagation: () => void;
}

export const Checkbox: React.FC<{
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (event: CheckboxChangeEvent) => void;
  children?: React.ReactNode;
}> = ({ checked, defaultChecked, disabled, className, style, onChange, children }) => (
  <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)} style={style}>
    <UiCheckbox
      checked={checked === undefined ? undefined : !!checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={(next) => onChange?.({ target: { checked: next === true }, stopPropagation: () => {} })}
    />
    {children ? <span>{children}</span> : null}
  </label>
);
