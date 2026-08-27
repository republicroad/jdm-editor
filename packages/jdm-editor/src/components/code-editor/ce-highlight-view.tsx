import { EditorState } from '@codemirror/state';
import { EditorView, placeholder as placeholderExt } from '@codemirror/view';
import clsx from 'clsx';
import React, { forwardRef, useEffect, useRef } from 'react';

import { useThemeMode } from '../../theme';
import { syntaxHighlighting } from '@codemirror/language';
import { zenLanguage, zenStyleDark, zenStyleLight } from './extensions/zen';

/**
 * P2 phase-2 SPIKE (candidate A): read-only EditorView replacing the manual
 * CodeHighlighter DOM. Same engine as the live editor ⇒ display/edit geometry
 * is guaranteed instead of maintained. OFF by default — enable with
 * `localStorage.setItem('gru-hl-view','1')` for the Batch-H metrics run.
 */
export type CodeHighlighterViewProps = {
  value: string;
  type?: 'standard' | 'unary' | 'template';
  placeholder?: string;
  className?: string;
  maxRows?: number;
  fullHeight?: boolean;
  noStyle?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>;

export const CodeHighlighterView = forwardRef<HTMLDivElement, CodeHighlighterViewProps>((propsIn, fwdRef) => {
  const { value, type = 'standard', placeholder, className, maxRows, fullHeight, noStyle, style = {}, ...handlers } = propsIn;
  const hostRef = useRef<HTMLDivElement>(null);
  const mode = useThemeMode();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          EditorView.lineWrapping,
          zenLanguage,
          syntaxHighlighting(mode === 'dark' ? zenStyleDark : zenStyleLight),
          placeholder ? placeholderExt(placeholder) : [],
        ],
      }),
    });

    return () => view.destroy();
    // doc updates ride the value remount contract of the lazy path
  }, [value, type, mode, placeholder]);

  return (
    <div
      ref={(el) => { hostRef.current = el; if (typeof fwdRef === 'function') fwdRef(el); else if (fwdRef && typeof fwdRef === 'object') fwdRef.current = el; }}
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
  )});
