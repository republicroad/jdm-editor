import {
  SelectContent as SelectPrimitiveContent,
  SelectItem as SelectPrimitiveItem,
  Select as SelectPrimitiveRoot,
  SelectTrigger as SelectPrimitiveTrigger,
  SelectValue as SelectPrimitiveValue,
} from '#components/ui/select';
import { cn } from '#lib/utils';
import * as React from 'react';

import { borderlessInputClass } from './shared';

export interface SelectOption {
  /** Optional metadata used by the excel-import dialogs */
  id?: string;
  type?: string;
  wrapInQuotes?: boolean;
  /** Extra render node shown in the dropdown list */
  display?: React.ReactNode;
  label?: React.ReactNode;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface SelectProps {
  options?: SelectOption[];
  value?: string | number | boolean | Array<string | number>;
  defaultValue?: string | number | boolean | Array<string | number>;

  onChange?: (value: any, option?: SelectOption) => void;
  onSelect?: (value: string | number | boolean, option: SelectOption) => void;
  dropdownRender?: (menu: React.ReactNode) => React.ReactNode;
  optionRender?: (option: { data: SelectOption }) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  allowClear?: boolean;
  onClear?: () => void;
  optionLabelProp?: string;
  loading?: boolean;
  showSearch?: boolean;
  filterOption?: boolean | ((input: string, option: SelectOption) => boolean);
  mode?: 'multiple' | 'tags';
  variant?: string;
  suffixIcon?: React.ReactNode;
  popupMatchSelectWidth?: boolean | number;
  tokenSeparators?: string[];
  maxCount?: number;
  overlayClassName?: string;
  needConfirm?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  defaultValue,
  onChange,
  onSelect,
  onClear,
  dropdownRender,
  optionRender,
  placeholder,
  disabled,
  size,
  allowClear,
  loading,
  mode,
  tokenSeparators: _tokenSeparators,
  suffixIcon,
  popupMatchSelectWidth: _popupMatchSelectWidth,
  variant: _variant,
  showSearch: _showSearch,
  filterOption: _filterOption,
  optionLabelProp: _optionLabelProp,
  maxCount: _maxCount,
  className,
  style,
}) => {
  const list = options ?? [];
  const current = value === undefined || value === null ? undefined : String(value);
  const selected = list.find((option) => String(option.value) === current);

  if (mode === 'multiple' || mode === 'tags') {
    const arrayValue = Array.isArray(value) ? (value as Array<string | number>) : [];
    return (
      <input
        value={arrayValue.join(', ')}
        placeholder={placeholder}
        disabled={disabled || loading}
        onChange={(event) =>
          onChange?.(
            event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean),
          )
        }
        className={cn(borderlessInputClass, 'w-full rounded-md border border-input shadow-xs', className)}
        style={style}
      />
    );
  }

  const menu = (
    <>
      {list.map((option) => (
        <SelectPrimitiveItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {optionRender ? optionRender({ data: option }) : (option.label ?? String(option.value))}
        </SelectPrimitiveItem>
      ))}
    </>
  );

  return (
    <div className='relative inline-flex w-full items-center'>
      <SelectPrimitiveRoot
        value={current}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        onValueChange={(next) => {
          if (allowClear && next === current) return;
          const option = list.find((item) => String(item.value) === next) ?? ({} as SelectOption);
          const raw = option.value ?? next;
          onSelect?.(raw, option);
          onChange?.(raw, option);
        }}
        disabled={disabled || loading}
      >
        <SelectPrimitiveTrigger
          className={cn(
            'w-full justify-between',
            size === 'large' ? 'h-10 text-base' : size === 'small' ? 'h-8 text-xs' : undefined,
            allowClear && !!current && '[&>svg:last-child]:hidden',
            // compat semantics: suffixIcon={null} means no trailing icon.
            suffixIcon === null && '[&>svg:last-child]:hidden',
            className,
          )}
          style={style}
        >
          {/* Base UI Value renders children unconditionally (radix gated them
              on a selected value), so the never-reached placeholder-span
              fallback is intentionally dropped — behavior preserved. */}
          <SelectPrimitiveValue>{selected?.label}</SelectPrimitiveValue>
        </SelectPrimitiveTrigger>
        <SelectPrimitiveContent alignItemWithTrigger={false}>
          {dropdownRender ? dropdownRender(menu) : menu}
        </SelectPrimitiveContent>
      </SelectPrimitiveRoot>
      {allowClear && current ? (
        <button
          type='button'
          aria-label='Clear'
          onClick={() => {
            onClear?.();
            onChange?.(undefined, undefined);
          }}
          className='absolute right-7 flex size-3.5 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] leading-none text-background hover:bg-muted-foreground/50'
        >
          ✕{' '}
        </button>
      ) : null}
    </div>
  );
};
