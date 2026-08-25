import type { VariableType } from '@gorules/zen-engine-wasm';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import { Typography } from '../primitives';
import clsx from 'clsx';
import { GripVerticalIcon } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { getDropDirection } from '../../helpers/dnd';
import { getTrace } from '../../helpers/trace';
import { CodeEditorPreview } from '../code-editor/ce-preview';
import { ConfirmAction } from '../confirm-action';
import { DiffIcon } from '../diff-icon';
import { DiffAutosizeTextArea } from '../shared';
import { DiffCodeEditor } from '../shared/diff-ce';
import type { ExpressionEntry } from './context/expression-store.context';
import { useExpressionStore } from './context/expression-store.context';
import { ExpressionItemContextMenu } from './expression-item-context-menu';

export type ExpressionItemProps = {
  expression: ExpressionEntry;
  index: number;
  variableType?: VariableType;
};

export const ExpressionItem: React.FC<ExpressionItemProps> = ({ expression, index, variableType }) => {
  const [isFocused, setIsFocused] = useState(false);
  const expressionRef = useRef<HTMLDivElement>(null);
  const { updateRow, removeRow, disabled, permission } = useExpressionStore(
    ({ updateRow, removeRow, disabled, permission }) => ({
      updateRow,
      removeRow,
      disabled,
      permission,
    }),
  );

  const onChange = (update: Partial<Omit<ExpressionEntry, 'id'>>) => {
    updateRow(index, update);
  };

  const onRemove = () => {
    removeRow(index);
  };

  const actionDisabled = permission !== 'edit:full' || disabled;

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `expr-${expression.id ?? index}`,
    data: { index },
    disabled: actionDisabled,
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `expr-drop-${expression.id ?? index}`,
    data: { index },
  });

  const dndContext = useDndContext();
  const direction = isOver
    ? getDropDirection(dndContext.active?.rect.current.translated, expressionRef.current?.getBoundingClientRect())
    : 'up';

  const diffStatus = expression?._diff?.status;
  const diffBg =
    diffStatus === 'added'
      ? 'bg-[var(--grl-color-success-bg)]'
      : diffStatus === 'removed'
        ? 'bg-[var(--grl-color-error-bg)]'
        : diffStatus === 'modified'
          ? 'bg-[var(--grl-color-warning-bg)]'
          : 'bg-[var(--grl-color-bg-container)]';

  return (
    <div
      ref={(el) => {
        expressionRef.current = el;
        setDropNodeRef(el);
        setDragNodeRef(el);
      }}
      className={clsx(
        'group/item relative grid grid-cols-[40px_minmax(240px,1.1fr)_3fr_40px] items-start focus-within:[box-shadow:0_0_0_1px_var(--grl-color-border)]',
        "after:absolute after:left-0 after:right-0 after:bg-[var(--grl-color-primary)] after:content-['']",
        isOver && direction === 'down' && 'after:-bottom-px after:h-[2px]',
        isOver && direction === 'up' && 'after:-top-px after:h-[2px]',
        diffBg,
      )}
      style={{ opacity: !isDragging ? 1 : 0.5 }}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className='box-border flex h-full items-start justify-center border-r border-[var(--grl-color-border-fade)] pt-[15px] text-[var(--grl-color-text-secondary)] cursor-grab aria-disabled:cursor-not-allowed'
        aria-disabled={actionDisabled}
      >
        <div className='flex content-center gap-[3px] opacity-50 [&>span]:leading-[1.4]'>
          {expression?._diff?.status ? (
            <DiffIcon
              status={expression?._diff?.status}
              style={{
                fontSize: 16,
              }}
            />
          ) : (
            <GripVerticalIcon size={10} />
          )}
        </div>
      </div>
      <div className='box-border h-full border-r border-[var(--grl-color-border-fade)]'>
        <ExpressionItemContextMenu index={index}>
          <DiffAutosizeTextArea
            noStyle
            className='min-h-full py-3 px-3 text-[13px] leading-[1.5em] [font-family:var(--mono-font-family)] focus:shadow-none'
            placeholder='Key'
            maxRows={10}
            readOnly={permission !== 'edit:full' || disabled}
            displayDiff={expression?._diff?.fields?.key?.status === 'modified'}
            previousValue={expression?._diff?.fields?.key?.previousValue}
            value={expression?.key}
            onChange={(e) => onChange({ key: e.target.value })}
          />
        </ExpressionItemContextMenu>
      </div>
      <div className='relative box-border h-full text-[13px]'>
        <ExpressionItemContextMenu index={index}>
          <div>
            <DiffCodeEditor
              className='[&_.cm-content]:py-3! [&_.cm-content]:pr-[60px]! [&_.cm-content]:pl-3! [&_.cm-placeholder]:text-[#bfbfbf]!'
              placeholder='Expression'
              maxRows={9}
              disabled={disabled}
              value={expression?.value}
              displayDiff={expression?._diff?.fields?.value?.status === 'modified'}
              previousValue={expression?._diff?.fields?.value?.previousValue}
              onChange={(value) => onChange({ value })}
              variableType={variableType}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              noStyle={true}
            />
            <ResultOverlay expression={expression} />
          </div>
        </ExpressionItemContextMenu>
      </div>
      <div className='flex h-full box-border items-center justify-center [&>button]:hidden group-hover/item:[&>button]:flex group-focus-within/item:[&>button]:flex'>
        <ConfirmAction iconOnly disabled={permission !== 'edit:full' || disabled} onConfirm={onRemove} />
        {isFocused && <LivePreview id={expression.id} value={expression.value} />}
      </div>
    </div>
  );
};

const LivePreview = React.memo<{ id: string; value: string }>(({ id, value }) => {
  const { inputData, initial } = useExpressionStore(({ debug, debugIndex, calculatedInputData }) => {
    const snapshot = (debug?.snapshot?.expressions ?? []).find((e) => e.id === id);
    const trace = snapshot?.key ? getTrace(debug?.trace.traceData, debugIndex)?.[snapshot.key] : undefined;

    return {
      inputData: calculatedInputData,
      initial: snapshot && trace ? { expression: snapshot.value, result: trace.result } : undefined,
    };
  });

  return (
    <div className='absolute top-full right-0 z-[5] rounded-br-lg border-t border-[var(--grl-color-bg-layout)] bg-[var(--grl-color-bg-layout)] p-2 w-[400px] max-w-[50%] overflow-x-auto whitespace-nowrap opacity-100 [pointer-events:bounding-box] hover:opacity-50 [&_.grl-ce-preview]:bg-white'>
      <CodeEditorPreview expression={value} inputData={inputData} initial={initial} />
    </div>
  );
});

const ResultOverlay: React.FC<{ expression: ExpressionEntry }> = ({ expression }) => {
  const { trace } = useExpressionStore(({ debug, debugIndex }) => ({
    trace: getTrace(debug?.trace?.traceData, debugIndex)?.[expression.key]?.result,
  }));
  if (trace === undefined) {
    return null;
  }

  return (
    <div className='absolute top-1/2 right-[3px] -translate-y-1/2 rounded border border-[var(--grl-color-success-border)] bg-[var(--grl-color-success-bg)] px-1.5 py-0.5 max-h-[calc(100%-5px)] max-w-[50%] overflow-x-auto whitespace-nowrap [&>span]:text-xs [&>span]:[font-family:var(--mono-font-family)]'>
      <Typography.Text ellipsis={{ tooltip: (trace ?? undefined) as React.ReactNode }} style={{ maxWidth: 60, overflow: 'hidden' }}>
        = {JSON.stringify(trace)}
      </Typography.Text>
    </div>
  );
};
