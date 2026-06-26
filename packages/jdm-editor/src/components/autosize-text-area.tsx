import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';

import { composeRefs } from '../helpers/compose-refs';

export type AutosizeTextAreaProps = {
  maxRows: number;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
} & Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, 'onChange' | 'placeholder'>;

const getEditableText = (element: HTMLDivElement) => {
  const text = element.innerText.replace(/\r\n/g, '\n');

  return text.endsWith('\n') ? text.slice(0, -1) : text;
};

export const AutosizeTextArea = React.forwardRef<HTMLDivElement, AutosizeTextAreaProps>(
  ({ maxRows, className, value, onChange, placeholder, disabled, readOnly, style, ...props }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (divRef.current && getEditableText(divRef.current) !== value) {
        divRef.current.textContent = value ?? '';
      }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      if (onChange) {
        const value = getEditableText(e.currentTarget);
        const syntheticEvent = {
          target: { value },
          currentTarget: { value },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div
        className={clsx('grl-textarea-input', className)}
        ref={composeRefs(divRef, ref)}
        contentEditable={!disabled && !readOnly}
        onInput={handleInput}
        data-placeholder={placeholder}
        aria-disabled={disabled}
        style={{ '--textarea-max-rows': maxRows, ...style } as React.CSSProperties}
        {...props}
      />
    );
  },
);
