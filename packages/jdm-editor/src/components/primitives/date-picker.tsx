import * as React from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { cn } from '@/lib/utils';
import { borderlessInputClass } from './shared';

/** @deprecated antd-migration compat alias — use {@link DatePickerProps} instead. */
export interface AntdDatePickerProps {
  value?: Dayjs | null;
  onChange?: (date: Dayjs | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  variant?: string;
  format?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const toDayjs = (raw: string) => dayjs(raw);

export const DatePicker: React.FC<AntdDatePickerProps> = ({
  value,
  onChange,
  disabled,
  allowClear = true,
  className,
  style,
  placeholder,
}) => (
  <input
    type="date"
    value={value?.format ? value.format('YYYY-MM-DD') : ''}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) => {
      if (!event.target.value) {
        if (allowClear) onChange?.(null);
        return;
      }
      const parsed = toDayjs(event.target.value);
      if (parsed.isValid()) onChange?.(parsed);
    }}
    className={cn(
      borderlessInputClass,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);

export const TimePicker: React.FC<AntdDatePickerProps> = ({
  value,
  onChange,
  disabled,
  allowClear = true,
  className,
  style,
}) => (
  <input
    type="time"
    value={value?.format ? value.format('HH:mm') : ''}
    disabled={disabled}
    onChange={(event) => {
      if (!event.target.value) {
        if (allowClear) onChange?.(null);
        return;
      }
      const parsed = toDayjs(`2000-01-01 ${event.target.value}`);
      if (parsed.isValid()) onChange?.(parsed);
    }}
    className={cn(
      borderlessInputClass,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);

/** Neutral name (antd-migration compat surface). */
export type DatePickerProps = AntdDatePickerProps;
