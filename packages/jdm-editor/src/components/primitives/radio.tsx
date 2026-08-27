import * as React from 'react';

import { cn } from '@/lib/utils';

interface RadioContextValue {
  value?: string | number | boolean;
  setValue: (value: string | number | boolean) => void;
}

const RadioContext = React.createContext<RadioContextValue>({ setValue: () => {} });

const RadioGroupRoot: React.FC<{
  value?: string | number | boolean;
  size?: 'large' | 'middle' | 'small';
  disabled?: boolean;
  buttonStyle?: string;
  onChange?: (event: { target: { value: unknown } }) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, onChange, className, style, children }) => {
  const context = React.useMemo<RadioContextValue>(
    () => ({
      value,
      setValue: (next) => {
        if (!disabled) onChange?.({ target: { value: next } });
      },
    }),
    [value, disabled, onChange],
  );

  return (
    <RadioContext.Provider value={context}>
      <div
        role="radiogroup"
        className={cn(
          'inline-flex rounded-md border bg-muted p-0.5',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </RadioContext.Provider>
  );
};

const RadioButton: React.FC<{
  value?: string | number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, className, style, children }) => {
  const { value: current, setValue } = React.useContext(RadioContext);
  const active = current !== undefined && String(current) === String(value);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setValue(value!)}
      className={cn(
        'flex-1 whitespace-nowrap rounded-[4px] px-3 py-1 text-xs transition-colors',
        active ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
};

const RadioItem: React.FC<{
  value?: string | number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, className, style, children }) => {
  const { value: current, setValue } = React.useContext(RadioContext);
  const active = current !== undefined && String(current) === String(value);
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-1.5 text-sm',
        active ? 'text-primary' : 'text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      style={style}
      onClick={() => {
        if (!disabled) setValue(value!);
      }}
    >
      <span
        className={cn(
          'flex size-3.5 items-center justify-center rounded-full border transition-colors',
          active ? 'border-primary' : 'border-input',
        )}
      >
        {active ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      {children}
    </label>
  );
};

export const Radio = Object.assign(RadioItem, { Group: RadioGroupRoot, Button: RadioButton });

/** @deprecated antd-migration compat alias — use {@link RadioGroupProps} instead. */
export interface AntdRadioGroupProps {
  value?: string | number | boolean;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  options?: Array<{ label?: React.ReactNode; value: string | number; disabled?: boolean }>;
  onChange?: (event: { target: { value: unknown } }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export type RadioGroupProps = AntdRadioGroupProps;
