import { Input as UiInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import * as React from 'react';

/** @deprecated antd-migration compat alias — use {@link InputProps} instead. */
export interface AntdInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'suffix'> {
  size?: 'large' | 'middle' | 'small';
  allowClear?: boolean;
  bordered?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, AntdInputProps>(function Input(
  { size, allowClear = false, bordered = true, prefix, suffix, value, onChange, className, disabled, ...rest },
  ref,
) {
  const [internal, setInternal] = React.useState('');
  const current = value !== undefined ? String(value) : internal;

  const sizeClass = size === 'large' ? 'h-10 text-base' : size === 'small' ? 'h-8 text-xs' : undefined;

  return (
    <div className='relative inline-flex w-full items-center'>
      {prefix ? <span className='absolute left-2.5 flex text-muted-foreground [&_svg]:size-3.5'>{prefix}</span> : null}
      <UiInput
        ref={ref}
        value={current}
        onChange={(event) => {
          setInternal(event.target.value);
          onChange?.(event as never);
        }}
        disabled={disabled}
        className={cn(
          sizeClass,
          !bordered && 'border-0 shadow-none',
          allowClear && 'pr-7',
          prefix && 'pl-7',
          suffix && 'pr-8',
          className,
        )}
        {...rest}
      />
      {suffix ? <span className='absolute right-2 flex text-muted-foreground [&_svg]:size-3.5'>{suffix}</span> : null}
      {allowClear && current ? (
        <button
          type='button'
          aria-label='Clear'
          onClick={() => {
            setInternal('');
            if (onChange) {
              const event = { target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              onChange(event);
            }
          }}
          className='absolute right-2 flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] leading-none text-background hover:bg-muted-foreground/50'
        >
          ✕
        </button>
      ) : null}
    </div>
  );
});

export type InputRef = HTMLInputElement;

export type InputProps = React.ComponentProps<typeof Input>;
