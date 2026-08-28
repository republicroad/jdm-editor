import clsx from 'clsx';
import React from 'react';

import type { CodeEditorProps, CodeEditorRef } from '../code-editor';
import { CodeEditor } from '../code-editor';

export type DiffCodeEditorProps = CodeEditorProps & {
  displayDiff?: boolean;
  previousValue?: string;
  noStyle?: boolean;
};

export const DiffCodeEditor = React.forwardRef<CodeEditorRef, DiffCodeEditorProps>(
  ({ displayDiff, previousValue, noStyle, ...rest }, ref) => {
    if (displayDiff) {
      return (
        <div
          className={clsx(
            'w-full overflow-hidden border border-[var(--border)] rounded-[var(--grl-border-radius)]',
            noStyle && 'border-0 rounded-none',
          )}
        >
          {(previousValue || '')?.length > 0 && (
            <CodeEditor
              {...rest}
              className={clsx(rest.className, 'line-through decoration-[var(--destructive)]')}
              value={previousValue}
              onChange={undefined}
              disabled={true}
              noStyle
              lint={false}
            />
          )}
          {(rest?.value || '')?.length > 0 && (
            <CodeEditor {...rest} className={rest.className} disabled={true} noStyle lint={false} />
          )}
        </div>
      );
    }

    return <CodeEditor ref={ref} noStyle={noStyle} {...rest} />;
  },
);
