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
    {options.map((opt) => (
      <button
        key={opt.value}
        type='button'
        className={clsx(
          'rounded-md border bg-white px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer',
          'border-[#e5e7eb] text-[#374151]',
          'enabled:hover:border-[#3b82f6] enabled:hover:text-[#3b82f6]',
          value === opt.value && 'bg-[#dbeafe]! border-[#3b82f6]! text-[#1d4ed8]!',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={() => !disabled && onChange(opt.value)}
        disabled={disabled}
      >
        {opt.label}
      </button>
    ))}
  </div>
);
