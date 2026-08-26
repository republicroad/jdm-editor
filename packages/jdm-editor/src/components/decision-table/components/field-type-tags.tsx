import clsx from 'clsx';
import React from 'react';

export type FieldTypeTagsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export const FieldTypeTags = <T extends string>({
  options,
  value,
  onChange,
  disabled,
}: FieldTypeTagsProps<T>): React.ReactElement => (
  <div className='flex flex-wrap gap-1.5'>
    {options.map((opt) => {
      const selected = value === opt.value;
      return (
        <button
          key={opt.value}
          type='button'
          aria-pressed={selected}
          className={clsx(
            'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150',
            selected
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-input bg-transparent text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground',
            disabled && 'pointer-events-none opacity-50',
          )}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);
