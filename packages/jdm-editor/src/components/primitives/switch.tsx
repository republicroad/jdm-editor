import * as React from 'react';
import { Switch as UiSwitch } from '@/components/ui/switch';

import { cn } from '@/lib/utils';

/** @deprecated antd-migration compat alias — use {@link SwitchProps} instead. */
export interface AntdSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  size?: 'default' | 'small';
  className?: string;
  style?: React.CSSProperties;
  onChange?: (checked: boolean) => void;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
}

export const Switch: React.FC<AntdSwitchProps> = ({
  checked,
  defaultChecked,
  disabled,
  size,
  className,
  style,
  onChange,
}) => (
  <UiSwitch
    checked={checked === undefined ? undefined : !!checked}
    defaultChecked={defaultChecked}
    disabled={disabled}
    onCheckedChange={(next) => onChange?.(next === true)}
    className={cn(size === 'small' && 'data-[state=checked]:translate-x-3.5 h-4 w-7 [&_span]:size-3', className)}
    style={style}
  />
);

export type SwitchProps = AntdSwitchProps;
