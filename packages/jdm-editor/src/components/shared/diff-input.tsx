import { Input, type InputProps } from '../primitives';
import clsx from 'clsx';
import React from 'react';

export type DiffInputProps = InputProps & {
  previousValue?: string;
  displayDiff?: boolean;
};

export const DiffInput: React.FC<DiffInputProps> = ({ previousValue, displayDiff, ...rest }) => {
    if (displayDiff) {
      return (
        <div className='w-full overflow-hidden border border-[var(--border)] rounded-[var(--grl-border-radius)]'>
          {(previousValue || '')?.length > 0 && (
            <Input
              {...rest}
              value={previousValue}
              onChange={undefined}
              className={clsx(
                rest.className,
                'border-0 shadow-none focus:shadow-none focus:ring-0 line-through decoration-[var(--destructive)]',
              )}
            />
          )}
          {((rest?.value || '') as string)?.length > 0 && (
            <Input {...rest} className={clsx(rest.className, 'border-0 shadow-none focus:shadow-none focus:ring-0')} />
          )}
        </div>
      );
    }
  return <Input {...rest} />;
};
