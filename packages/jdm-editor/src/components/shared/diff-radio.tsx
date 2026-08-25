import type { RadioGroupProps } from '../primitives';
import { Radio } from '../primitives';
import clsx from 'clsx';
import React from 'react';

export type DiffRadioProps = {
  previousValue?: string;
  displayDiff?: boolean;
} & RadioGroupProps;

export const DiffRadio: React.FC<DiffRadioProps> = ({ displayDiff, previousValue, options, ...rest }) => {
  return (
    <Radio.Group {...rest}>
      {(options || []).map((option: any) => (
        <Radio
          value={option.value}
          key={option.value}
          className={clsx([
            displayDiff &&
              option.value === previousValue &&
              'text-[var(--grl-color-error)] line-through decoration-[var(--grl-color-error)]',
            displayDiff && option.value === rest.value && 'text-[var(--grl-color-success)]',
          ])}
        >
          {option.label}
        </Radio>
      ))}
    </Radio.Group>
  );
};
