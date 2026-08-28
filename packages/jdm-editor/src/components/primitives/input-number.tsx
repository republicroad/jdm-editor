import { cn } from '@/lib/utils';
import * as React from 'react';

import { borderlessInputClass } from './shared';

export const InputNumber: React.FC<{
  value?: number | null;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  controls?: boolean;
  variant?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (value: number | null) => void;
}> = ({ value, min, max, step, disabled, size, placeholder, className, style, onChange }) => (
  <input
    type='number'
    value={value === undefined || value === null ? '' : value}
    min={min}
    max={max}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) => onChange?.(event.target.value === '' ? null : Number(event.target.value))}
    className={cn(
      borderlessInputClass,
      size === 'large' ? 'h-10 text-base' : undefined,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);
