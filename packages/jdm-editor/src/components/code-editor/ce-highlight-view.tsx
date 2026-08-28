import clsx from 'clsx';
import React, { forwardRef } from 'react';

import { useRecycledEditorView, type DisplayType } from './cell-view-pool';

/**
 * Read-only display surface backed by a RECYCLED EditorView from the
 * Table-scope CellViewPool (roadmap §3.6 revival, Phase 1). Falls back to
 * standalone create/destroy when no pool provider is present.
 * Still OFF by default — enable with localStorage.gru-hl-view='1'.
 */
export type CodeHighlighterViewProps = {
  value: string;
  type?: DisplayType;
  placeholder?: string;
  className?: string;
  maxRows?: number;
  fullHeight?: boolean;
  noStyle?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;

export const CodeHighlighterView = forwardRef<HTMLDivElement, CodeHighlighterViewProps>((propsIn, fwdRef) => {
  const {
    value,
    type = 'standard',
    placeholder,
    className,
    maxRows,
    fullHeight,
    noStyle,
    style = {},
    ...handlers
  } = propsIn;

  const hostRef = useRecycledEditorView({ value, type, placeholder });

  return (
    <div
      ref={(el) => {
        hostRef(el);
        if (typeof fwdRef === 'function') fwdRef(el);
        else if (fwdRef && typeof fwdRef === 'object') fwdRef.current = el;
      }}
      {...handlers}
      className={clsx(
        'grl-ce',
        'grl-ce-highlighter-view',
        noStyle && 'no-style',
        maxRows && !fullHeight && 'max-rows',
        fullHeight && 'full-height',
        className,
      )}
      style={{ '--editorMaxRows': maxRows, ...style } as React.CSSProperties}
    />
  );
});
