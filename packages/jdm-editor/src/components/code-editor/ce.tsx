import React, { useCallback, useRef, useState } from 'react';

import { composeRefs } from '../../helpers/compose-refs';
import type { CodeEditorBaseProps, CodeEditorBaseRef } from './ce-base';
import { CodeEditorBase } from './ce-base';
import { CodeHighlighter } from './ce-highlight';
import { CodeHighlighterView } from './ce-highlight-view';

/**
 * P2 phase-2 SPIKE flag (Batch H): read-only-EditorView display path.
 * `localStorage.gru-hl-view = '1'` enables it; default remains the manual
 * highlighter. Decision memo pending — do not ship enabled.
 */
const highlighterViewEnabled = (): boolean =>
  typeof localStorage !== 'undefined' && localStorage.getItem('gru-hl-view') === '1';

export type CodeEditorRef = CodeEditorBaseRef;

export type CodeEditorProps = CodeEditorBaseProps & {
  lazy?: boolean;
};

const getCursorPositionFromClick = (
  event: React.MouseEvent,
  containerElement: HTMLElement,
): CodeEditorProps['initialSelection'] | null => {
  const selection = document.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);

    const startRange = document.createRange();
    startRange.selectNodeContents(containerElement);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = document.createRange();
    endRange.selectNodeContents(containerElement);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
      anchor: startRange.toString().length,
      head: endRange.toString().length,
    };
  }

  const position = document.caretPositionFromPoint(event.clientX, event.clientY);
  if (!position) {
    return null;
  }

  const preRange = document.createRange();
  preRange.selectNodeContents(containerElement);
  preRange.setEnd(position.offsetNode, position.offset);

  return { anchor: preRange.toString().length };
};

type EditorState = { type: 'lazy' } | { type: 'edit'; initialSelection?: CodeEditorProps['initialSelection'] };

export const CodeEditor = React.forwardRef<CodeEditorRef, CodeEditorProps>(
  ({ lazy = false, value = '', type = 'standard', disabled, onBlur, ...props }, ref) => {
    const [editorState, setEditorState] = useState<EditorState>(() => (lazy ? { type: 'lazy' } : { type: 'edit' }));
    const containerRef = useRef<HTMLDivElement>(null);
    const isMouseDownRef = useRef(false);

    const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
        isMouseDownRef.current = true;

        // Suppress the browser's default caret/selection + focus so the lazy
        // highlighter hands off cleanly to the live editor. This also prevents
        // the cell-level `onFocus` re-render from swallowing the gesture.
        event.preventDefault();

        if (disabled || editorState.type !== 'lazy') {
          return;
        }

        const selection = containerRef.current
          ? (getCursorPositionFromClick(event, containerRef.current) ?? { anchor: value.length })
          : { anchor: value.length };

        setEditorState({ type: 'edit', initialSelection: selection });
      },
      [disabled, editorState.type, value],
    );

    const handleMouseUp = useCallback(() => {
      isMouseDownRef.current = false;
    }, []);

    const handleClick = useCallback(
      (event: React.MouseEvent) => {
        if (disabled || editorState.type !== 'lazy') {
          return;
        }

        const selection = containerRef.current
          ? (getCursorPositionFromClick(event, containerRef.current) ?? undefined)
          : undefined;

        setEditorState({ type: 'edit', initialSelection: selection });
      },
      [disabled, editorState.type],
    );

    const handleFocus = useCallback(
      (_event: React.FocusEvent<HTMLDivElement, Element>) => {
        if (disabled || editorState.type !== 'lazy' || isMouseDownRef.current) {
          return;
        }

        setEditorState({ type: 'edit', initialSelection: { anchor: value.length } });
      },
      [disabled, editorState.type, value],
    );

    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLDivElement, HTMLDivElement>) => {
        onBlur?.(event);

        if (lazy) {
          setEditorState({ type: 'lazy' });
        }
      },
      [lazy, onBlur],
    );

    // Consumer-supplied DOM handlers must still fire, but internal behavior
    // must never be clobbered when callers pass e.g. onFocus via props
    // (previously `{...props}` sat AFTER these and silently replaced them).
    // Internal handlers run LAST and are post-transition no-ops by guard, so a
    // chained click/focus can never double-trigger the lazy→edit transition.
    const chainMouse =
      (...handlers: (((event: React.MouseEvent<HTMLDivElement>) => void) | undefined)[]) =>
      (event: React.MouseEvent<HTMLDivElement>) => {
        for (const handler of handlers) {
          handler?.(event);
        }
      };
    const chainFocus =
      (...handlers: (((event: React.FocusEvent<HTMLDivElement>) => void) | undefined)[]) =>
      (event: React.FocusEvent<HTMLDivElement>) => {
        for (const handler of handlers) {
          handler?.(event);
        }
      };

    const { onClick, onFocus, onMouseDown, onMouseUp, ...restProps } = props;

    if (editorState.type === 'edit' || !lazy) {
      return (
        <CodeEditorBase
          ref={ref}
          {...restProps}
          value={value}
          type={type}
          disabled={disabled}
          initialSelection={editorState.type === 'edit' ? editorState.initialSelection : undefined}
          onClick={chainMouse(onClick)}
          onMouseDown={chainMouse(onMouseDown)}
          onMouseUp={chainMouse(onMouseUp)}
          onFocus={chainFocus(onFocus)}
          onBlur={handleBlur}
        />
      );
    }

    if (highlighterViewEnabled()) {
      return (
        <CodeHighlighterView
          ref={composeRefs(containerRef, ref)}
          type={type as 'standard' | 'unary' | 'template'}
          value={value}
          placeholder={props.placeholder}
          className={props.className}
          maxRows={props.maxRows}
          fullHeight={props.fullHeight}
          noStyle={props.noStyle}
          style={props.style}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onFocus={handleFocus}
        />
      );
    }

    return (
      <CodeHighlighter
        ref={composeRefs(containerRef, ref)}
        {...restProps}
        type={type}
        value={value}
        disabled={disabled}
        onClick={chainMouse(onClick, handleClick)}
        onFocus={chainFocus(onFocus, handleFocus)}
        onMouseDown={chainMouse(onMouseDown, handleMouseDown)}
        onMouseUp={chainMouse(onMouseUp, handleMouseUp)}
      />
    );
  },
);
