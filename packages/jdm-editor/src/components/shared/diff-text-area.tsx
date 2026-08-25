import clsx from 'clsx';
import React, { forwardRef } from 'react';

import { AutosizeTextArea, type AutosizeTextAreaProps } from '../autosize-text-area';

export type DiffAutosizeTextAreaProps = AutosizeTextAreaProps & {
  previousValue?: string;
  displayDiff?: boolean;
  noStyle?: boolean;
};

export const DiffAutosizeTextArea = forwardRef<HTMLDivElement, DiffAutosizeTextAreaProps>(
  ({ previousValue, displayDiff, noStyle, ...rest }, ref) => {
    if (displayDiff) {
      return (
        <div
          className={clsx(
            'w-full overflow-hidden border border-[var(--grl-color-border)] rounded-[var(--grl-border-radius)]',
            noStyle && 'border-0 rounded-none',
          )}
        >
          {(previousValue || '')?.length > 0 && (
            <AutosizeTextArea
              {...rest}
              value={previousValue}
              onChange={undefined}
              className={clsx(
                rest.className,
                'border-0 shadow-none focus:shadow-none focus:ring-0 line-through decoration-[var(--grl-color-error)]',
              )}
            />
          )}
          {((rest.value || '') as string)?.length > 0 && (
            <AutosizeTextArea
              {...rest}
              className={clsx(rest.className, 'border-0 shadow-none focus:shadow-none focus:ring-0')}
            />
          )}
        </div>
      );
    }
    return <AutosizeTextArea ref={ref} noStyle={noStyle} {...rest} />;
  },
);
